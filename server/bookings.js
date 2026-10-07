import PDFDocument from 'pdfkit';
import { requireAuth, requireRole } from './auth.js';
import { fail, idValue, today, textValue, transaction, couponDiscount } from './domain.js';
import { findVehicle, availability } from './vehicles.js';
const bookingSelect = `SELECT b.*,v.name AS vehicle_name,v.type,v.location,v.images,v.owner_id,v.archived,
  u.name AS customer_name,u.email AS customer_email,o.name AS owner_name,
  r.id AS review_id,r.rating AS review_rating,r.body AS review_body
  FROM bookings b JOIN vehicles v ON v.id=b.vehicle_id JOIN users u ON u.id=b.customer_id
  JOIN users o ON o.id=v.owner_id LEFT JOIN reviews r ON r.booking_id=b.id`;
function bookingJson(row) {
  return { ...row, images: JSON.parse(row.images), snapshot: JSON.parse(row.snapshot) };
}
function bookingFor(db, id, user) {
  const row = db.prepare(`${bookingSelect} WHERE b.id=?`).get(idValue(id));
  if (!row) fail('Booking not found.', 404);
  if (row.customer_id !== user.id && row.owner_id !== user.id)
    fail('You cannot access this booking.', 403);
  return bookingJson(row);
}
export function quoteBooking(db, vehicle, start, end, code) {
  const result = availability(db, vehicle, start, end);
  if (!result.available)
    fail('This vehicle is unavailable for those dates. Choose another date range.', 409);
  const subtotal = result.days * vehicle.daily_price;
  let coupon = null,
    discount = 0;
  if (code !== undefined && code !== null && code !== '') {
    coupon = textValue(code, 'Coupon', 1, 32).toUpperCase();
    if (!/^[A-Z0-9]+$/.test(coupon)) fail('Enter a valid coupon code.');
    discount = couponDiscount(
      db.prepare('SELECT * FROM coupons WHERE code=?').get(coupon),
      subtotal,
    );
  }
  return {
    days: result.days,
    daily_price: vehicle.daily_price,
    subtotal,
    discount,
    total: subtotal - discount,
    coupon,
    available: true,
  };
}
export function setupBookings(app, db, config) {
  const streams = new Map();
  function notification(userId, bookingId, message) {
    db.prepare('INSERT INTO notifications (user_id,booking_id,message) VALUES (?,?,?)').run(
      userId,
      bookingId,
      message,
    );
  }
  function publish(...users) {
    for (const userId of users)
      for (const stream of streams.get(userId) || [])
        stream.res.write('event: notification\ndata: {}\n\n');
  }
  app.get('/api/notifications', requireAuth, (req, res) =>
    res.json(
      db
        .prepare('SELECT * FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 100')
        .all(req.user.id),
    ),
  );
  app.patch('/api/notifications/read', requireAuth, (req, res) => {
    db.prepare('UPDATE notifications SET seen=1 WHERE user_id=?').run(req.user.id);
    res.json({ ok: true });
  });
  app.get('/api/notifications/stream', requireAuth, (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    const stream = { res };
    const set = streams.get(req.user.id) || new Set();
    if (set.size >= 5) {
      res.end();
      return;
    }
    set.add(stream);
    streams.set(req.user.id, set);
    res.write('event: connected\ndata: {}\n\n');
    const timer = setInterval(() => {
      if (
        !db
          .prepare('SELECT hash FROM sessions WHERE hash=? AND expires>?')
          .get(req.session.session_hash, Date.now())
      )
        return res.end();
      res.write(': keepalive\n\n');
    }, 15000);
    const cleanup = () => {
      clearInterval(timer);
      set.delete(stream);
      if (!set.size) streams.delete(req.user.id);
    };
    res.on('close', cleanup);
  });
  app.post('/api/bookings/quote', requireRole('customer'), (req, res) => {
    const v = findVehicle(db, req.body.vehicle_id);
    res.json(quoteBooking(db, v, req.body.start_date, req.body.end_date, req.body.coupon));
  });
  app.post('/api/bookings', requireRole('customer'), (req, res) => {
    const result = transaction(db, () => {
      const v = findVehicle(db, req.body.vehicle_id);
      const quote = quoteBooking(db, v, req.body.start_date, req.body.end_date, req.body.coupon);
      if (
        req.body.expected_total !== undefined &&
        (req.body.expected_total !== quote.total ||
          req.body.expected_daily_price !== quote.daily_price)
      )
        fail('The rental price changed. Check availability again to see the updated price.', 409);
      const snapshot = {
        vehicle: v.name,
        registration: v.registration,
        location: v.location,
        owner: v.owner_name,
        customer: req.user.name,
        customer_email: req.user.email,
      };
      const id = Number(
        db
          .prepare(
            `INSERT INTO bookings (vehicle_id,customer_id,start_date,end_date,daily_price,days,subtotal,discount,total,coupon,snapshot) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
          )
          .run(
            v.id,
            req.user.id,
            req.body.start_date,
            req.body.end_date,
            quote.daily_price,
            quote.days,
            quote.subtotal,
            quote.discount,
            quote.total,
            quote.coupon,
            JSON.stringify(snapshot),
          ).lastInsertRowid,
      );
      notification(
        req.user.id,
        id,
        `Rental request #${id} for ${v.name} is confirmed and awaiting owner approval.`,
      );
      notification(
        v.owner_id,
        id,
        `${req.user.name} requested ${v.name} for ${req.body.start_date} to ${req.body.end_date}.`,
      );
      return { id, owner: v.owner_id };
    });
    publish(req.user.id, result.owner);
    res.status(201).json(bookingFor(db, result.id, req.user));
  });
  app.get('/api/bookings', requireAuth, (req, res) => {
    const field = req.user.role === 'owner' ? 'v.owner_id' : 'b.customer_id';
    res.json(
      db
        .prepare(`${bookingSelect} WHERE ${field}=? ORDER BY b.start_date DESC,b.id DESC`)
        .all(req.user.id)
        .map(bookingJson),
    );
  });
  app.patch('/api/bookings/:id/status', requireAuth, (req, res) => {
    const result = transaction(db, () => {
      const b = bookingFor(db, req.params.id, req.user);
      const next = req.body.status;
      if (req.user.role === 'customer') {
        if (b.customer_id !== req.user.id || next !== 'cancelled')
          fail('You can only cancel your own rental.', 403);
        if (!['requested', 'approved'].includes(b.status) || b.start_date <= today())
          fail('Only requested or approved rentals before pickup day can be cancelled.', 409);
      } else {
        if (b.owner_id !== req.user.id) fail('You can only manage rentals for your vehicles.', 403);
        const transitions = {
          requested: ['approved', 'rejected'],
          approved: b.end_date <= today() ? ['rejected'] : ['handed_over'],
          handed_over: ['returned'],
        };
        if (!transitions[b.status]?.includes(next))
          fail('This booking status change is not allowed.', 409);
        if (next === 'handed_over' && (b.start_date > today() || b.end_date <= today()))
          fail('Handover is only allowed during the rental dates.', 409);
        if (next === 'approved' && b.end_date <= today())
          fail('This request has expired. Reject it so the dates are released.', 409);
      }
      db.prepare('UPDATE bookings SET status=? WHERE id=?').run(next, b.id);
      const readable = {
        approved: 'approved',
        rejected: 'declined',
        handed_over: 'handed over',
        returned: 'marked as returned',
        cancelled: 'cancelled',
      }[next];
      notification(
        b.customer_id,
        b.id,
        `Your ${b.snapshot.vehicle} rental #${b.id} was ${readable}.`,
      );
      notification(b.owner_id, b.id, `Rental #${b.id} for ${b.snapshot.vehicle} was ${readable}.`);
      return b;
    });
    publish(result.customer_id, result.owner_id);
    res.json(bookingFor(db, result.id, req.user));
  });
  app.post('/api/reviews', requireRole('customer'), (req, res) => {
    const b = bookingFor(db, req.body.booking_id, req.user);
    if (b.customer_id !== req.user.id || b.status !== 'returned')
      fail('You can only review a rental after the vehicle is returned.', 403);
    const rating = Number(req.body.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) fail('Choose a rating from 1 to 5.');
    const body = textValue(req.body.body, 'Review', 10, 2000);
    db.prepare(
      `INSERT INTO reviews (booking_id,vehicle_id,customer_id,rating,body) VALUES (?,?,?,?,?) ON CONFLICT(booking_id) DO UPDATE SET rating=excluded.rating,body=excluded.body,updated_at=CURRENT_TIMESTAMP`,
    ).run(b.id, b.vehicle_id, req.user.id, rating, body);
    res.json(db.prepare('SELECT * FROM reviews WHERE booking_id=?').get(b.id));
  });
  app.get('/api/dashboard', requireAuth, (req, res) => {
    if (req.user.role === 'customer') {
      const rentals = db
        .prepare(`${bookingSelect} WHERE b.customer_id=? ORDER BY b.start_date DESC,b.id DESC`)
        .all(req.user.id)
        .map(bookingJson);
      const counts = {
        upcoming: rentals.filter(
          (x) => ['requested', 'approved'].includes(x.status) && x.start_date >= today(),
        ).length,
        active: rentals.filter((x) => x.status === 'handed_over').length,
        completed: rentals.filter((x) => x.status === 'returned').length,
      };
      res.json({ role: 'customer', ...counts });
    } else {
      const vehicles = db
        .prepare('SELECT COUNT(*) AS count FROM vehicles WHERE owner_id=? AND archived=0')
        .get(req.user.id).count;
      const rentals = db
        .prepare(
          'SELECT b.* FROM bookings b JOIN vehicles v ON v.id=b.vehicle_id WHERE v.owner_id=?',
        )
        .all(req.user.id);
      const ratings = db
        .prepare(
          'SELECT AVG(r.rating) AS average,COUNT(*) AS count FROM reviews r JOIN vehicles v ON v.id=r.vehicle_id WHERE v.owner_id=?',
        )
        .get(req.user.id);
      res.json({
        role: 'owner',
        vehicles,
        active: rentals.filter((x) => x.status === 'handed_over').length,
        pending: rentals.filter((x) => x.status === 'requested').length,
        revenue: rentals
          .filter((x) => x.status === 'returned')
          .reduce((sum, x) => sum + x.total, 0),
        rating: ratings.average || 0,
        review_count: ratings.count,
      });
    }
  });
  app.get('/api/bookings/:id/invoice', requireAuth, (req, res) => {
    const b = bookingFor(db, req.params.id, req.user);
    const document = new PDFDocument({
      size: 'A4',
      margin: 55,
      info: { Title: `Wheels 2 Go invoice #${b.id}` },
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="wheels-2-go-${b.id}.pdf"`);
    document.pipe(res);
    const amount = (value) => `INR ${(value / 100).toFixed(2)}`;
    document.fillColor('#2058cb').font('Helvetica-Bold').fontSize(26).text('Wheels 2 Go');
    document.moveDown().fillColor('#172332').fontSize(18).text('Rental invoice');
    document
      .font('Helvetica')
      .fontSize(11)
      .moveDown()
      .text(`Booking reference: W2G-${String(b.id).padStart(5, '0')}`);
    document.text(`Issued: ${today()}   |   Status: ${b.status.replaceAll('_', ' ')}`);
    document
      .moveDown()
      .text(`Customer: ${b.snapshot.customer}`)
      .text(`Email: ${b.snapshot.customer_email}`)
      .text(`Vehicle owner: ${b.snapshot.owner}`);
    document
      .moveDown()
      .font('Helvetica-Bold')
      .text(b.snapshot.vehicle)
      .font('Helvetica')
      .text(`Registration: ${b.snapshot.registration}`)
      .text(`Pickup location: ${b.snapshot.location}`);
    document
      .moveDown()
      .text(`Pickup: ${b.start_date}`)
      .text(`Return: ${b.end_date}`)
      .text(`Rental duration: ${b.days} day${b.days === 1 ? '' : 's'} (return date excluded)`);
    document
      .moveDown()
      .text(`Daily rental price: ${amount(b.daily_price)}`)
      .text(`Subtotal: ${amount(b.subtotal)}`)
      .text(`Discount${b.coupon ? ` (${b.coupon})` : ''}: ${amount(b.discount)}`);
    document
      .moveDown()
      .font('Helvetica-Bold')
      .fontSize(16)
      .text(`Total rental cost: ${amount(b.total)}`);
    document
      .moveDown(2)
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#59687a')
      .text(
        'This document records the agreed rental cost. It is not a payment receipt or tax invoice. Payment collection is outside this application.',
      );
    if (['cancelled', 'rejected'].includes(b.status))
      document
        .moveDown()
        .text(
          'This rental is no longer active. The amount shown is historical and is not a charge.',
        );
    document.end();
  });
  return () => {
    for (const set of streams.values()) for (const stream of set) stream.res.end();
  };
}
