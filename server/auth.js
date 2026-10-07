import { randomBytes } from 'node:crypto';
import rateLimit from 'express-rate-limit';
import { OAuth2Client } from 'google-auth-library';
import {
  fail,
  textValue,
  emailValue,
  passwordValue,
  hashPassword,
  verifyPassword,
  tokenHash,
} from './domain.js';
export const publicUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
});
export function cookies(req) {
  return Object.fromEntries(
    (req.headers.cookie || '')
      .split(';')
      .map((x) =>
        x
          .trim()
          .split('=')
          .map((v) => v.trim()),
      )
      .filter((x) => x.length === 2),
  );
}
export function requireAuth(req, res, next) {
  if (!req.user)
    return next(Object.assign(new Error('Please sign in to continue.'), { status: 401 }));
  next();
}
export function requireRole(role) {
  return (req, res, next) => {
    if (!req.user)
      return next(Object.assign(new Error('Please sign in to continue.'), { status: 401 }));
    if (req.user.role !== role)
      return next(Object.assign(new Error(`This action is for ${role}s.`), { status: 403 }));
    next();
  };
}
export function setupAuth(app, db, config) {
  const cookieOptions = { httpOnly: true, sameSite: 'lax', secure: config.production, path: '/' };
  function newSession(res, user) {
    const token = randomBytes(32).toString('hex');
    const csrf = randomBytes(32).toString('hex');
    const expires = Date.now() + 7 * 86400000;
    db.prepare('INSERT INTO sessions (hash,user_id,csrf,expires) VALUES (?,?,?,?)').run(
      tokenHash(token),
      user.id,
      csrf,
      expires,
    );
    res.cookie('siva_session', token, { ...cookieOptions, maxAge: 7 * 86400000 });
    return { user: publicUser(user), csrf };
  }
  app.use('/api', (req, res, next) => {
    const token = cookies(req).siva_session;
    if (token && /^[a-f0-9]{64}$/.test(token)) {
      const row = db
        .prepare(
          'SELECT u.*,s.hash AS session_hash,s.csrf,s.expires FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.hash=? AND s.expires>?',
        )
        .get(tokenHash(token), Date.now());
      if (row) {
        req.user = publicUser(row);
        req.session = row;
      }
    }
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      if (req.headers.origin !== config.origin)
        return next(Object.assign(new Error('Request origin is not allowed.'), { status: 403 }));
      if (req.user && req.headers['x-csrf-token'] !== req.session.csrf)
        return next(
          Object.assign(new Error('Your session changed. Refresh the page and try again.'), {
            status: 403,
          }),
        );
    }
    next();
  });
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: config.test ? 500 : 25,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many sign-in attempts. Try again in 15 minutes.' },
  });
  app.get('/api/auth/me', (req, res) =>
    res.json({
      user: req.user || null,
      csrf: req.session?.csrf || null,
      google: !!(config.googleId && config.googleSecret),
      demo: config.demo,
    }),
  );
  app.post('/api/auth/register', limiter, async (req, res) => {
    const name = textValue(req.body.name, 'Name', 2, 80);
    const email = emailValue(req.body.email);
    const password = passwordValue(req.body.password);
    const role = req.body.role;
    if (!['customer', 'owner'].includes(role)) fail('Choose Customer or Vehicle owner.');
    if (db.prepare('SELECT id FROM users WHERE email=?').get(email))
      fail('An account already uses this email.', 409);
    const hash = await hashPassword(password);
    let id;
    try {
      id = Number(
        db
          .prepare('INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)')
          .run(name, email, hash, role).lastInsertRowid,
      );
    } catch (error) {
      if (error.message.includes('UNIQUE')) fail('An account already uses this email.', 409);
      throw error;
    }
    if (req.session) db.prepare('DELETE FROM sessions WHERE hash=?').run(req.session.session_hash);
    res.status(201).json(newSession(res, { id, name, email, role }));
  });
  app.post('/api/auth/login', limiter, async (req, res) => {
    const email = emailValue(req.body.email);
    const password = req.body.password;
    if (typeof password !== 'string' || password.length < 1 || password.length > 128)
      fail('Enter your password.');
    const user = db.prepare('SELECT * FROM users WHERE email=?').get(email);
    // A dummy scrypt hash makes nonexistent-account and incorrect-password work comparable.
    const dummy = `scrypt:${'0'.repeat(32)}:${'0'.repeat(128)}`;
    const valid = await verifyPassword(password, user?.password_hash || dummy);
    if (!user || !user.password_hash || !valid) fail('Email or password is incorrect.', 401);
    if (req.session) db.prepare('DELETE FROM sessions WHERE hash=?').run(req.session.session_hash);
    res.json(newSession(res, user));
  });
  app.post('/api/auth/logout', requireAuth, (req, res) => {
    db.prepare('DELETE FROM sessions WHERE hash=?').run(req.session.session_hash);
    res.clearCookie('siva_session', cookieOptions);
    res.json({ ok: true });
  });
  app.get('/api/profile', requireAuth, (req, res) => {
    const user = db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id);
    res.json({
      ...publicUser(user),
      phone: user.phone,
      city: user.city,
      bio: user.bio,
      hasPassword: !!user.password_hash,
      googleLinked: !!user.google_id,
      createdAt: user.created_at,
    });
  });
  app.patch('/api/profile', requireAuth, (req, res) => {
    const name = textValue(req.body.name, 'Name', 2, 80);
    const optional = (value, label, max) => {
      if (typeof value !== 'string' || value.trim().length > max)
        fail(`${label} must be at most ${max} characters.`);
      return value.trim();
    };
    const phone = optional(req.body.phone, 'Phone number', 25);
    if (phone && !/^\+?[\d ()-]{7,25}$/.test(phone)) fail('Enter a valid phone number.');
    const city = optional(req.body.city, 'City', 80);
    const bio = optional(req.body.bio, 'About', 500);
    db.prepare('UPDATE users SET name=?,phone=?,city=?,bio=? WHERE id=?').run(
      name,
      phone,
      city,
      bio,
      req.user.id,
    );
    res.json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id)) });
  });
  app.post('/api/profile/password', limiter, requireAuth, async (req, res) => {
    const user = db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id);
    if (!user.password_hash) fail('Manage your password in your Google account.', 400);
    const current = req.body.current_password;
    if (
      typeof current !== 'string' ||
      current.length > 128 ||
      !(await verifyPassword(current, user.password_hash))
    )
      fail('Your current password is incorrect.', 401);
    const password = passwordValue(req.body.password);
    if (password === current) fail('Choose a different new password.');
    const hash = await hashPassword(password);
    const result = db
      .prepare('UPDATE users SET password_hash=? WHERE id=? AND password_hash=?')
      .run(hash, user.id, user.password_hash);
    if (!result.changes) fail('Your password changed in another session. Sign in again.', 409);
    db.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id);
    res.json(newSession(res, user));
  });
  app.get('/api/auth/google', limiter, (req, res) => {
    if (!config.googleId || !config.googleSecret)
      fail('Google login is not configured. Use email login.', 503);
    const role = req.query.role || 'customer';
    if (!['customer', 'owner'].includes(role)) fail('Invalid account role.');
    const state = randomBytes(32).toString('hex');
    const nonce = randomBytes(32).toString('hex');
    db.prepare('DELETE FROM oauth_states WHERE expires<?').run(Date.now());
    const returnRoute =
      typeof req.query.returnTo === 'string' &&
      /^(vehicle\/[1-9]\d*|explore|rentals|saved|owner|bookings|profile)$/.test(req.query.returnTo)
        ? req.query.returnTo
        : '';
    db.prepare(
      'INSERT INTO oauth_states (hash,role,nonce,expires,return_route) VALUES (?,?,?,?,?)',
    ).run(tokenHash(state), role, nonce, Date.now() + 600000, returnRoute);
    res.cookie('siva_oauth', state, { ...cookieOptions, maxAge: 600000 });
    const client = new OAuth2Client(config.googleId, config.googleSecret, config.googleRedirect);
    res.redirect(
      client.generateAuthUrl({
        scope: ['openid', 'email', 'profile'],
        state,
        nonce,
        access_type: 'online',
        prompt: 'select_account',
      }),
    );
  });
  app.get('/api/auth/google/callback', async (req, res) => {
    try {
      const { state, code } = req.query;
      if (
        typeof state !== 'string' ||
        !/^[a-f0-9]{64}$/.test(state) ||
        cookies(req).siva_oauth !== state
      )
        fail('Google login could not be verified.', 403);
      const saved = db
        .prepare('SELECT * FROM oauth_states WHERE hash=? AND expires>?')
        .get(tokenHash(state), Date.now());
      db.prepare('DELETE FROM oauth_states WHERE hash=?').run(tokenHash(state));
      res.clearCookie('siva_oauth', cookieOptions);
      if (!saved || typeof code !== 'string') fail('Google login expired or was declined.');
      const client = new OAuth2Client(config.googleId, config.googleSecret, config.googleRedirect);
      const { tokens } = await client.getToken(code);
      const ticket = await client.verifyIdToken({
        idToken: tokens.id_token,
        audience: config.googleId,
      });
      const identity = ticket.getPayload();
      if (!identity?.email_verified || identity.nonce !== saved.nonce)
        fail('Google identity could not be verified.');
      const email = emailValue(identity.email);
      let user = db.prepare('SELECT * FROM users WHERE google_id=?').get(identity.sub);
      if (!user) {
        // Never silently link an existing password account merely because email matches.
        if (db.prepare('SELECT id FROM users WHERE email=?').get(email))
          fail('This email already has an account. Use your password to sign in.');
        const id = Number(
          db
            .prepare('INSERT INTO users (name,email,role,google_id) VALUES (?,?,?,?)')
            .run(
              textValue(identity.name || email.split('@')[0], 'Name', 1, 80),
              email,
              saved.role,
              identity.sub,
            ).lastInsertRowid,
        );
        user = db.prepare('SELECT * FROM users WHERE id=?').get(id);
      }
      if (req.session)
        db.prepare('DELETE FROM sessions WHERE hash=?').run(req.session.session_hash);
      newSession(res, user);
      const allowedReturn = [
        'explore',
        'profile',
        ...(user.role === 'owner' ? ['owner', 'bookings'] : ['rentals', 'saved']),
      ];
      const destination =
        saved.return_route &&
        (saved.return_route.startsWith('vehicle/') || allowedReturn.includes(saved.return_route))
          ? saved.return_route
          : user.role === 'owner'
            ? 'owner'
            : 'rentals';
      res.redirect(`${config.origin}/?auth=success#${destination}`);
    } catch (error) {
      res.redirect(
        `${config.origin}/?authError=${encodeURIComponent(error.status ? error.message : 'Google sign-in failed. Please try email login.')}#login`,
      );
    }
  });
}
