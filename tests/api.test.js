import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { OAuth2Client } from 'google-auth-library';
import { createApp } from '../server/app.js';
import { openDatabase } from '../server/db.js';
import { today } from '../server/domain.js';
import { addDays } from '../server/seed.js';
const origin = 'http://localhost:5173';
async function fixture(t, options = {}) {
  const folder = await mkdtemp(join(tmpdir(), 'siva-test-'));
  const context = await createApp({
    db: openDatabase(':memory:'),
    uploadDir: folder,
    origin,
    test: true,
    demo: true,
    googleId: '',
    googleSecret: '',
    ...options,
  });
  const server = context.app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    context.closeStreams();
    await new Promise((resolve) => server.close(resolve));
    context.db.close();
    await rm(folder, { recursive: true, force: true });
  });
  async function call(path, { method = 'GET', body, user, headers = {} } = {}) {
    const form = body instanceof FormData;
    const res = await fetch(url + '/api' + path, {
      method,
      headers: {
        Origin: origin,
        ...(body && !form ? { 'Content-Type': 'application/json' } : {}),
        ...(user ? { Cookie: user.cookie, 'X-CSRF-Token': user.csrf } : {}),
        ...headers,
      },
      body: body ? (form ? body : JSON.stringify(body)) : undefined,
      redirect: 'manual',
    });
    const data = res.headers.get('content-type')?.includes('application/json')
      ? await res.json()
      : await res.arrayBuffer();
    return { status: res.status, data, res };
  }
  async function login(email) {
    const r = await call('/auth/login', {
      method: 'POST',
      body: { email, password: 'SivaDemo2026!' },
    });
    assert.equal(r.status, 200);
    return { ...r.data, cookie: r.res.headers.get('set-cookie').split(';')[0] };
  }
  return { ...context, url, call, login, folder };
}
function rental(vehicle = 1, start = addDays(today(), 20), end = addDays(today(), 22)) {
  return { vehicle_id: vehicle, start_date: start, end_date: end };
}
async function book(f, user, data = rental()) {
  const r = await f.call('/bookings', { method: 'POST', user, body: data });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  return r.data;
}
test('public discovery, type/location/name/price/owner filters and reserved dates work', async (t) => {
  const f = await fixture(t);
  assert.equal((await f.call('/vehicles')).data.length, 6);
  const bikes = await f.call('/vehicles?type=Bike&location=Chennai&max=1000&owner=3');
  assert.equal(bikes.data.length, 1);
  assert.equal(bikes.data[0].name, 'Royal Enfield Classic 350');
  assert.equal((await f.call('/vehicles?q=Swift')).data[0].review_count, 1);
  const dates = new URLSearchParams({ start: addDays(today(), 7), end: addDays(today(), 10) });
  assert.ok(!(await f.call('/vehicles?' + dates)).data.some((x) => x.id === 2));
  assert.equal((await f.call('/vehicles?start=2028-01-01')).status, 400);
  assert.equal((await f.call('/vehicles?min=4000&max=1000')).status, 400);
  assert.equal((await f.call('/vehicles/1')).data.reviews[0].customer_email, undefined);
});
test('registration, session, password login, logout, role and CSRF boundaries', async (t) => {
  const f = await fixture(t);
  assert.equal((await f.call('/bookings')).status, 401);
  assert.equal(
    (
      await f.call('/auth/register', {
        method: 'POST',
        body: { name: 'New Customer', email: 'new@test.com', password: 'short', role: 'customer' },
      })
    ).status,
    400,
  );
  const created = await f.call('/auth/register', {
    method: 'POST',
    body: {
      name: 'New Customer',
      email: 'new@test.com',
      password: 'LongPassword2026',
      role: 'customer',
    },
  });
  assert.equal(created.status, 201);
  assert.ok(!('password_hash' in created.data.user));
  const user = { ...created.data, cookie: created.res.headers.get('set-cookie').split(';')[0] };
  assert.equal((await f.call('/auth/me', { user })).data.user.name, 'New Customer');
  assert.equal((await f.call('/vehicles', { method: 'POST', user, body: {} })).status, 403);
  assert.equal(
    (await f.call('/auth/logout', { method: 'POST', user, headers: { 'X-CSRF-Token': 'wrong' } }))
      .status,
    403,
  );
  assert.equal(
    (
      await f.call('/auth/logout', {
        method: 'POST',
        user,
        headers: { Origin: 'https://evil.test' },
      })
    ).status,
    403,
  );
  assert.equal((await f.call('/auth/logout', { method: 'POST', user })).status, 200);
  assert.equal((await f.call('/bookings', { user })).status, 401);
  assert.equal(
    (
      await f.call('/auth/login', {
        method: 'POST',
        body: { email: 'new@test.com', password: 'wrongpassword' },
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await f.call('/auth/login', {
        method: 'POST',
        body: { email: 'NEW@test.com', password: 'LongPassword2026' },
      })
    ).status,
    200,
  );
  assert.equal((await f.call('/auth/google')).status, 503);
  assert.equal((await f.call('/auth/google/callback?state=bad&code=bad')).status, 302);
});
test('quotes, coupons and frozen prices survive later listing edits', async (t) => {
  const f = await fixture(t),
    customer = await f.login('customer@siva.test'),
    owner = await f.login('owner@siva.test');
  const data = { ...rental(), coupon: 'first10' };
  const quote = await f.call('/bookings/quote', { method: 'POST', user: customer, body: data });
  assert.equal(quote.status, 200);
  assert.equal(quote.data.total, 324000);
  assert.equal(
    (
      await f.call('/bookings/quote', {
        method: 'POST',
        user: customer,
        body: { ...data, coupon: 'BAD' },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await f.call('/bookings/quote', {
        method: 'POST',
        user: customer,
        body: { ...data, coupon: 'ROAD500' },
      })
    ).status,
    400,
  );
  const b = await book(f, customer, data);
  assert.equal(b.total, 324000);
  const v = (await f.call('/vehicles/1')).data;
  const changed = await f.call('/vehicles/1', {
    method: 'PATCH',
    user: owner,
    body: { ...v, daily_price: '9900', name: 'Renamed vehicle' },
  });
  assert.equal(changed.status, 200);
  const rentals = await f.call('/bookings', { user: customer });
  const frozen = rentals.data.find((x) => x.id === b.id);
  assert.equal(frozen.daily_price, 180000);
  assert.equal(frozen.snapshot.vehicle, 'Maruti Suzuki Swift');
  const invoice = await f.call(`/bookings/${b.id}/invoice`, { user: customer });
  assert.equal(invoice.status, 200);
  assert.ok(Buffer.from(invoice.data).subarray(0, 4).equals(Buffer.from('%PDF')));
});
test('simultaneous requests prevent overlap, permit adjacent ranges and reject invalid dates', async (t) => {
  const f = await fixture(t),
    user = await f.login('customer@siva.test');
  const responses = await Promise.all([
    f.call('/bookings', { method: 'POST', user, body: rental() }),
    f.call('/bookings', { method: 'POST', user, body: rental() }),
  ]);
  assert.deepEqual(responses.map((r) => r.status).sort(), [201, 409]);
  for (const [a, b] of [
    [19, 21],
    [21, 23],
    [19, 23],
    [20, 21],
  ])
    assert.equal(
      (
        await f.call('/bookings', {
          method: 'POST',
          user,
          body: rental(1, addDays(today(), a), addDays(today(), b)),
        })
      ).status,
      409,
    );
  await book(f, user, rental(1, addDays(today(), 22), addDays(today(), 23)));
  for (const [start, end] of [
    [today(), today()],
    [addDays(today(), -2), today()],
    ['2028-02-30', '2028-03-02'],
  ])
    assert.equal(
      (await f.call('/bookings', { method: 'POST', user, body: rental(4, start, end) })).status,
      400,
    );
  assert.throws(
    () =>
      f.db
        .prepare(
          "INSERT INTO bookings (vehicle_id,customer_id,start_date,end_date,daily_price,days,subtotal,total,snapshot) VALUES (1,1,?,?,180000,2,360000,360000,'{}')",
        )
        .run(addDays(today(), 20), addDays(today(), 22)),
    /booking_overlap/,
  );
});
test('role and ownership checks guard booking transitions and invoice access', async (t) => {
  const f = await fixture(t),
    c = await f.login('customer@siva.test'),
    o = await f.login('owner@siva.test'),
    other = await f.login('meera@siva.test');
  const b = await book(f, c);
  const status = (user, next) =>
    f.call(`/bookings/${b.id}/status`, { method: 'PATCH', user, body: { status: next } });
  assert.equal((await status(c, 'approved')).status, 403);
  assert.equal((await status(other, 'approved')).status, 403);
  assert.equal((await f.call(`/bookings/${b.id}/invoice`, { user: other })).status, 403);
  assert.equal((await status(o, 'returned')).status, 409);
  assert.equal((await status(o, 'approved')).status, 200);
  assert.equal((await status(o, 'handed_over')).status, 409);
  assert.equal((await status(c, 'cancelled')).status, 200);
  assert.equal((await status(o, 'approved')).status, 409);
  await book(f, c); // cancellation frees the range
  assert.equal(
    (await f.call('/bookings', { method: 'POST', user: o, body: rental(5) })).status,
    403,
  );
});
test('today rental can be handed over, returned and reviewed exactly once with editable content', async (t) => {
  const f = await fixture(t),
    c = await f.login('customer@siva.test'),
    o = await f.login('owner@siva.test');
  const b = await book(f, c, rental(5, today(), addDays(today(), 1)));
  const review = {
    booking_id: b.id,
    rating: 4,
    body: 'A smooth drive with a clean and comfortable cabin.',
  };
  assert.equal((await f.call('/reviews', { method: 'POST', user: c, body: review })).status, 403);
  assert.equal(
    (
      await f.call(`/bookings/${b.id}/status`, {
        method: 'PATCH',
        user: c,
        body: { status: 'cancelled' },
      })
    ).status,
    409,
  );
  for (const status of ['approved', 'handed_over', 'returned'])
    assert.equal(
      (await f.call(`/bookings/${b.id}/status`, { method: 'PATCH', user: o, body: { status } }))
        .status,
      200,
    );
  assert.equal((await f.call('/reviews', { method: 'POST', user: o, body: review })).status, 403);
  assert.equal(
    (await f.call('/reviews', { method: 'POST', user: c, body: { ...review, rating: 6 } })).status,
    400,
  );
  assert.equal((await f.call('/reviews', { method: 'POST', user: c, body: review })).status, 200);
  assert.equal(
    (await f.call('/reviews', { method: 'POST', user: c, body: { ...review, rating: 5 } })).status,
    200,
  );
  const v = (await f.call('/vehicles/5')).data;
  assert.equal(v.review_count, 1);
  assert.equal(v.rating, 5);
  assert.equal((await f.call('/dashboard', { user: o })).data.revenue, 600000);
});
test('favorites persist and owner vehicle deletion respects active bookings and preserves history', async (t) => {
  const f = await fixture(t),
    c = await f.login('customer@siva.test'),
    o = await f.login('owner@siva.test'),
    other = await f.login('meera@siva.test');
  assert.equal((await f.call('/favorites/1', { method: 'PUT', user: c })).status, 200);
  await f.call('/favorites/1', { method: 'PUT', user: c });
  assert.equal((await f.call('/favorites', { user: c })).data.length, 1);
  assert.equal((await f.call('/favorites/1', { method: 'PUT', user: o })).status, 403);
  assert.equal((await f.call('/vehicles/1', { method: 'DELETE', user: other })).status, 403);
  assert.equal((await f.call('/vehicles/2', { method: 'DELETE', user: o })).status, 409);
  await f.call('/vehicles/1', { method: 'PATCH', user: o, body: { available: false } });
  assert.equal(
    (await f.call('/bookings', { method: 'POST', user: c, body: rental() })).status,
    409,
  );
  assert.equal((await f.call('/vehicles/1', { method: 'DELETE', user: o })).status, 200);
  assert.equal((await f.call('/vehicles/1')).status, 404);
  assert.equal((await f.call('/favorites', { user: c })).data.length, 0);
  assert.equal((await f.call('/bookings/1/invoice', { user: c })).status, 200);
  await f.call('/favorites/1', { method: 'DELETE', user: c });
  assert.deepEqual((await f.call('/favorite-ids', { user: c })).data, []);
});
test('multiple image uploads decode actual images and restrict listing image ownership', async (t) => {
  const f = await fixture(t),
    o = await f.login('owner@siva.test'),
    other = await f.login('meera@siva.test'),
    c = await f.login('customer@siva.test');
  const buffer = await sharp({
    create: { width: 20, height: 20, channels: 3, background: '#2058cb' },
  })
    .png()
    .toBuffer();
  const upload = new FormData();
  upload.append('images', new Blob([buffer], { type: 'image/png' }), 'car.png');
  upload.append('images', new Blob([buffer], { type: 'image/png' }), 'car2.png');
  const r = await f.call('/uploads', { method: 'POST', user: o, body: upload });
  assert.equal(r.status, 201);
  assert.equal(r.data.images.length, 2);
  const data = {
    name: 'Test vehicle',
    summary: 'A comfortable test vehicle.',
    description: 'A detailed description for our test vehicle.',
    type: 'Car',
    registration: 'TN01TEST123',
    daily_price: '1250.50',
    location: 'Chennai',
    available: true,
    features: ['GPS'],
    images: r.data.images,
  };
  assert.equal(
    (await f.call('/vehicles', { method: 'POST', user: other, body: data })).status,
    400,
  );
  const created = await f.call('/vehicles', { method: 'POST', user: o, body: data });
  assert.equal(created.status, 201);
  assert.equal(created.data.daily_price, 125050);
  assert.equal((await f.call('/vehicles', { method: 'POST', user: o, body: data })).status, 409);
  assert.equal(
    (
      await f.call('/vehicles', {
        method: 'POST',
        user: o,
        body: {
          ...data,
          registration: 'TN01TEST999',
          images: ['/uploads/2-' + 'a'.repeat(32) + '.webp'],
        },
      })
    ).status,
    400,
  );
  const fake = new FormData();
  fake.append('images', new Blob(['<svg>fake</svg>'], { type: 'image/png' }), 'fake.png');
  assert.equal((await f.call('/uploads', { method: 'POST', user: o, body: fake })).status, 400);
  assert.equal(
    (await f.call('/uploads', { method: 'POST', user: c, body: new FormData() })).status,
    403,
  );
});
test('SSE emits status notifications and unread/read records remain durable', async (t) => {
  const f = await fixture(t),
    c = await f.login('customer@siva.test');
  const controller = new AbortController();
  t.after(() => controller.abort());
  const res = await fetch(f.url + '/api/notifications/stream', {
    headers: { Cookie: c.cookie },
    signal: controller.signal,
  });
  assert.equal(res.status, 200);
  const reader = res.body.getReader();
  assert.match(new TextDecoder().decode((await reader.read()).value), /connected/);
  await book(f, c);
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    assert.match(new TextDecoder().decode((await reader.read()).value), /event: notification/);
  } finally {
    clearTimeout(timeout);
    controller.abort();
  }
  const items = await f.call('/notifications', { user: c });
  assert.ok(items.data.some((x) => x.message.includes('awaiting owner approval')));
  await f.call('/notifications/read', { method: 'PATCH', user: c });
  assert.ok((await f.call('/notifications', { user: c })).data.every((x) => x.seen === 1));
});
test('SQLite data survives reopening and enforces relationships', async (t) => {
  const folder = await mkdtemp(join(tmpdir(), 'siva-persistence-'));
  t.after(() => rm(folder, { recursive: true, force: true }));
  const file = join(folder, 'rental.sqlite');
  let db = openDatabase(file);
  db.prepare('INSERT INTO users (name,email,role) VALUES (?,?,?)').run(
    'Persistent customer',
    'persist@test.com',
    'customer',
  );
  db.close();
  db = openDatabase(file);
  assert.equal(db.prepare('SELECT name FROM users').get().name, 'Persistent customer');
  assert.throws(() => db.prepare('INSERT INTO favorites VALUES (1,999)').run(), /FOREIGN KEY/);
  db.close();
});

test('expired approved rentals can be closed without allowing a retroactive handover', async (t) => {
  const f = await fixture(t),
    c = await f.login('customer@siva.test'),
    o = await f.login('owner@siva.test');
  const b = await book(f, c, rental(5));
  await f.call(`/bookings/${b.id}/status`, {
    method: 'PATCH',
    user: o,
    body: { status: 'approved' },
  });
  f.db
    .prepare('UPDATE bookings SET start_date=?,end_date=? WHERE id=?')
    .run(addDays(today(), -3), addDays(today(), -1), b.id);
  assert.equal(
    (
      await f.call(`/bookings/${b.id}/status`, {
        method: 'PATCH',
        user: o,
        body: { status: 'handed_over' },
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await f.call(`/bookings/${b.id}/status`, {
        method: 'PATCH',
        user: o,
        body: { status: 'rejected' },
      })
    ).status,
    200,
  );
});

test('stale quoted prices are rejected rather than silently accepting a different cost', async (t) => {
  const f = await fixture(t),
    c = await f.login('customer@siva.test'),
    o = await f.login('owner@siva.test');
  const q = (await f.call('/bookings/quote', { method: 'POST', user: c, body: rental() })).data;
  const vehicle = (await f.call('/vehicles/1')).data;
  await f.call('/vehicles/1', {
    method: 'PATCH',
    user: o,
    body: { ...vehicle, daily_price: '2000' },
  });
  const response = await f.call('/bookings', {
    method: 'POST',
    user: c,
    body: { ...rental(), expected_total: q.total, expected_daily_price: q.daily_price },
  });
  assert.equal(response.status, 409);
  assert.match(response.data.error, /price changed/);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM bookings').get().n, 2);
});

test('password spaces round-trip and malformed or missing JSON is a validation error', async (t) => {
  const f = await fixture(t);
  const password = '  LongPassword2026  ';
  const r = await f.call('/auth/register', {
    method: 'POST',
    body: { name: 'Space Test', email: 'spaces@test.com', password, role: 'customer' },
  });
  assert.equal(r.status, 201);
  assert.equal(
    (await f.call('/auth/login', { method: 'POST', body: { email: 'spaces@test.com', password } }))
      .status,
    200,
  );
  assert.equal((await f.call('/auth/login', { method: 'POST' })).status, 400);
  assert.equal((await f.call('/auth/register', { method: 'POST', body: [] })).status, 400);
});

test('private profiles persist edits without changing account identity or exposing contact details', async (t) => {
  const f = await fixture(t),
    owner = await f.login('owner@siva.test');
  assert.equal((await f.call('/profile')).status, 401);
  const body = {
    name: 'Updated Rental Owner',
    phone: '+91 98765 43210',
    city: 'Chennai',
    bio: 'Private rental handover notes',
    email: 'attacker@test.com',
    role: 'customer',
  };
  const updated = await f.call('/profile', { method: 'PATCH', user: owner, body });
  assert.equal(updated.status, 200);
  assert.equal(updated.data.user.role, 'owner');
  assert.equal(updated.data.user.email, 'owner@siva.test');
  const profile = (await f.call('/profile', { user: owner })).data;
  assert.equal(profile.phone, body.phone);
  assert.equal(profile.bio, body.bio);
  assert.equal(profile.hasPassword, true);
  const vehicles = (await f.call('/vehicles')).data;
  assert.equal(vehicles.find((v) => v.owner_id === owner.user.id).owner_name, body.name);
  assert.ok(!JSON.stringify(vehicles).includes(body.phone));
  assert.ok(!JSON.stringify(vehicles).includes(body.bio));
  assert.equal(
    (
      await f.call('/profile', {
        method: 'PATCH',
        user: owner,
        body: { ...body, phone: 'invalid' },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await f.call('/profile', {
        method: 'PATCH',
        user: owner,
        headers: { 'X-CSRF-Token': 'bad' },
        body,
      })
    ).status,
    403,
  );
  assert.equal((await f.call('/profile', { user: owner })).data.phone, body.phone);
});

test('password changes verify the current password and rotate/revoke sessions', async (t) => {
  const f = await fixture(t),
    first = await f.login('customer@siva.test'),
    second = await f.login('customer@siva.test');
  assert.equal(
    (
      await f.call('/profile/password', {
        method: 'POST',
        user: first,
        body: { current_password: 'wrong', password: 'NewPassword2026!' },
      })
    ).status,
    401,
  );
  assert.equal((await f.call('/auth/me', { user: first })).data.user.id, first.user.id);
  const changed = await f.call('/profile/password', {
    method: 'POST',
    user: first,
    body: { current_password: 'SivaDemo2026!', password: 'NewPassword2026!' },
  });
  assert.equal(changed.status, 200);
  assert.equal((await f.call('/auth/me', { user: second })).data.user, null);
  assert.equal((await f.call('/auth/me', { user: first })).data.user, null);
  const rotated = { ...changed.data, cookie: changed.res.headers.get('set-cookie').split(';')[0] };
  assert.equal((await f.call('/auth/me', { user: rotated })).data.user.id, first.user.id);
  assert.equal(
    (
      await f.call('/auth/login', {
        method: 'POST',
        body: { email: 'customer@siva.test', password: 'SivaDemo2026!' },
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await f.call('/auth/login', {
        method: 'POST',
        body: { email: 'customer@siva.test', password: 'NewPassword2026!' },
      })
    ).status,
    200,
  );
});

test('Google callbacks bind browser state and nonce, preserve roles, reject replay and password-account linking', async (t) => {
  const f = await fixture(t, {
    googleId: 'test-google-client',
    googleSecret: 'test-secret',
    googleRedirect: 'http://localhost:3001/api/auth/google/callback',
  });
  let identity;
  t.mock.method(OAuth2Client.prototype, 'getToken', async (code) => {
    assert.equal(code, 'test-code');
    return { tokens: { id_token: 'test-id-token' } };
  });
  t.mock.method(OAuth2Client.prototype, 'verifyIdToken', async (options) => {
    assert.equal(options.audience, 'test-google-client');
    return { getPayload: () => identity };
  });
  async function start(returnTo = '') {
    const result = await f.call('/auth/google?role=owner&returnTo=' + encodeURIComponent(returnTo));
    assert.equal(result.status, 302);
    const url = new URL(result.res.headers.get('location'));
    assert.equal(
      url.searchParams.get('redirect_uri'),
      'http://localhost:3001/api/auth/google/callback',
    );
    assert.equal(url.searchParams.get('scope'), 'openid email profile');
    return {
      state: url.searchParams.get('state'),
      nonce: url.searchParams.get('nonce'),
      cookie: result.res.headers.get('set-cookie').split(';')[0],
    };
  }
  const flow = await start();
  identity = {
    sub: 'google-user-id',
    email: 'google@test.com',
    email_verified: true,
    name: 'Google Owner',
    nonce: flow.nonce,
  };
  const path = `/auth/google/callback?state=${flow.state}&code=test-code`;
  const badBrowser = await f.call(path);
  assert.ok(badBrowser.res.headers.get('location').includes('authError='));
  const success = await f.call(path, { headers: { Cookie: flow.cookie } });
  assert.equal(success.res.headers.get('location'), origin + '/?auth=success#owner');
  const sessionCookie = success.res.headers
    .getSetCookie()
    .find((x) => x.startsWith('siva_session='))
    .split(';')[0];
  const googleUser = (await f.call('/auth/me', { headers: { Cookie: sessionCookie } })).data.user;
  assert.equal(googleUser.role, 'owner');
  const replay = await f.call(path, { headers: { Cookie: flow.cookie } });
  assert.ok(replay.res.headers.get('location').includes('authError='));
  const passwordAccount = await start();
  identity = {
    ...identity,
    sub: 'different-google-id',
    email: 'customer@siva.test',
    nonce: passwordAccount.nonce,
  };
  const conflict = await f.call(
    `/auth/google/callback?state=${passwordAccount.state}&code=test-code`,
    { headers: { Cookie: passwordAccount.cookie } },
  );
  assert.ok(decodeURIComponent(conflict.res.headers.get('location')).includes('Use your password'));
  assert.ok(conflict.res.headers.get('location').endsWith('#login'));
  const returning = await start('vehicle/1');
  identity = {
    ...identity,
    sub: 'google-user-id',
    email: 'google@test.com',
    nonce: returning.nonce,
  };
  const returned = await f.call(`/auth/google/callback?state=${returning.state}&code=test-code`, {
    headers: { Cookie: returning.cookie },
  });
  assert.equal(returned.res.headers.get('location'), origin + '/?auth=success#vehicle/1');
  const unsafe = await start('https://example.com/steal');
  identity = { ...identity, nonce: unsafe.nonce };
  const safe = await f.call(`/auth/google/callback?state=${unsafe.state}&code=test-code`, {
    headers: { Cookie: unsafe.cookie },
  });
  assert.equal(safe.res.headers.get('location'), origin + '/?auth=success#owner');
  const wrongRole = await start('rentals');
  identity = { ...identity, nonce: wrongRole.nonce };
  const roleSafe = await f.call(`/auth/google/callback?state=${wrongRole.state}&code=test-code`, {
    headers: { Cookie: wrongRole.cookie },
  });
  assert.equal(roleSafe.res.headers.get('location'), origin + '/?auth=success#owner');
  const badNonce = await start();
  identity = { ...identity, email: 'another-google@test.com', nonce: 'wrong' };
  const invalid = await f.call(`/auth/google/callback?state=${badNonce.state}&code=test-code`, {
    headers: { Cookie: badNonce.cookie },
  });
  assert.ok(
    decodeURIComponent(invalid.res.headers.get('location')).includes('could not be verified'),
  );
  assert.equal(
    f.db.prepare('SELECT COUNT(*) AS count FROM users WHERE google_id IS NOT NULL').get().count,
    1,
  );
});
