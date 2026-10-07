import multer from 'multer';
import sharp from 'sharp';
import { randomBytes } from 'node:crypto';
import { writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { requireRole } from './auth.js';
import { TYPES, fail, textValue, moneyValue, idValue, rentalDays, transaction } from './domain.js';
import { vehicleSelect, vehicleJson } from './db.js';
const reservedSql =
  "SELECT start_date,end_date FROM bookings WHERE vehicle_id=? AND status IN ('requested','approved','handed_over') ORDER BY start_date";
export function findVehicle(db, id, includeArchived = false) {
  const row = db
    .prepare(`${vehicleSelect} WHERE v.id=? ${includeArchived ? '' : 'AND v.archived=0'}`)
    .get(idValue(id));
  if (!row) fail('Vehicle not found.', 404);
  return vehicleJson(row);
}
export function ownedVehicle(db, id, userId) {
  const row = findVehicle(db, id);
  if (row.owner_id !== userId) fail('You can only manage your own vehicles.', 403);
  return row;
}
export function availability(db, vehicle, start, end) {
  const days = rentalDays(start, end);
  const overlap = db
    .prepare(
      "SELECT id FROM bookings WHERE vehicle_id=? AND status IN ('requested','approved','handed_over') AND start_date<? AND end_date>? LIMIT 1",
    )
    .get(vehicle.id, end, start);
  return { days, available: vehicle.available && !vehicle.archived && !overlap };
}
function vehicleInput(body, previous, uploadDir, userId) {
  const name = textValue(body.name, 'Vehicle name', 2, 100);
  const summary = textValue(body.summary, 'Short description', 5, 160);
  const description = textValue(body.description, 'Detailed description', 20, 4000);
  if (!TYPES.includes(body.type)) fail('Choose Car, SUV, Bike or Van.');
  const registration = textValue(body.registration, 'Registration number', 4, 25).toUpperCase();
  if (!/^[A-Z0-9 -]+$/.test(registration))
    fail('Registration can contain letters, digits, spaces and hyphens.');
  const dailyPrice = moneyValue(body.daily_price);
  const location = textValue(body.location, 'Location', 2, 80);
  if (typeof body.available !== 'boolean') fail('Availability must be true or false.');
  if (!Array.isArray(body.features) || body.features.length > 20) fail('Choose up to 20 features.');
  const features = [...new Set(body.features.map((x) => textValue(x, 'Feature', 1, 60)))];
  if (!Array.isArray(body.images) || body.images.length < 1 || body.images.length > 8)
    fail('Add between 1 and 8 images.');
  const images = body.images.map((x) => {
    if (typeof x !== 'string') fail('Invalid image.');
    // Uploaded filenames carry the owner ID. Existing images may only be retained on their own listing.
    if (previous?.images.includes(x)) return x;
    if (!new RegExp(`^/uploads/${userId}-[a-f0-9]{32}\\.webp$`).test(x))
      fail('Use images uploaded through this form.');
    if (!existsSync(join(uploadDir, x.split('/').pop())))
      fail('An uploaded image could not be found. Upload it again.');
    return x;
  });
  if (new Set(images).size !== images.length) fail('Remove duplicate images.');
  return {
    name,
    summary,
    description,
    type: body.type,
    registration,
    daily_price: dailyPrice,
    location,
    available: Number(body.available),
    features: JSON.stringify(features),
    images: JSON.stringify(images),
  };
}
export function setupVehicles(app, db, config) {
  app.get('/api/vehicles', (req, res) => {
    const {
      q = '',
      type = '',
      location = '',
      owner = '',
      min = '',
      max = '',
      start = '',
      end = '',
      sort = 'recommended',
    } = req.query;
    if ([q, type, location, owner, min, max, start, end, sort].some((x) => typeof x !== 'string'))
      fail('Invalid search filters.');
    if (q.length > 100 || location.length > 80) fail('Search is too long.');
    if (type && !TYPES.includes(type)) fail('Invalid vehicle type.');
    if (!!start !== !!end) fail('Choose both pickup and return dates.');
    if (start) rentalDays(start, end);
    const conditions = ['v.archived=0'];
    const params = [];
    if (q) {
      conditions.push('v.name LIKE ?');
      params.push(`%${q}%`);
    }
    if (type) {
      conditions.push('v.type=?');
      params.push(type);
    }
    if (location) {
      conditions.push('v.location=? COLLATE NOCASE');
      params.push(location);
    }
    if (owner) {
      conditions.push('v.owner_id=?');
      params.push(idValue(owner));
    }
    for (const [value, operator] of [
      [min, '>='],
      [max, '<='],
    ]) {
      if (value !== '') {
        if (!/^\d+(\.\d{1,2})?$/.test(value) || Number(value) > 1000000)
          fail('Invalid price range.');
        conditions.push(`v.daily_price${operator}?`);
        params.push(Math.round(Number(value) * 100));
      }
    }
    if (min !== '' && max !== '' && Number(min) > Number(max))
      fail('Minimum price cannot exceed maximum price.');
    if (start) {
      conditions.push(
        "v.available=1 AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.vehicle_id=v.id AND b.status IN ('requested','approved','handed_over') AND b.start_date<? AND b.end_date>?)",
      );
      params.push(end, start);
    }
    const orders = {
      recommended: 'rating DESC, v.id',
      price_asc: 'v.daily_price ASC',
      price_desc: 'v.daily_price DESC',
      newest: 'v.id DESC',
    };
    if (!orders[sort]) fail('Invalid sort order.');
    res.json(
      db
        .prepare(`${vehicleSelect} WHERE ${conditions.join(' AND ')} ORDER BY ${orders[sort]}`)
        .all(...params)
        .map(vehicleJson),
    );
  });
  app.get('/api/filters', (req, res) =>
    res.json({
      locations: db
        .prepare('SELECT DISTINCT location FROM vehicles WHERE archived=0 ORDER BY location')
        .all()
        .map((x) => x.location),
      owners: db
        .prepare(
          'SELECT DISTINCT u.id,u.name FROM users u JOIN vehicles v ON u.id=v.owner_id WHERE v.archived=0 ORDER BY u.name',
        )
        .all(),
    }),
  );
  app.get('/api/owner/vehicles', requireRole('owner'), (req, res) =>
    res.json(
      db
        .prepare(`${vehicleSelect} WHERE v.owner_id=? AND v.archived=0 ORDER BY v.id DESC`)
        .all(req.user.id)
        .map(vehicleJson),
    ),
  );
  app.get('/api/vehicles/:id', (req, res) => {
    const vehicle = findVehicle(db, req.params.id);
    const reviews = db
      .prepare(
        'SELECT r.id,r.booking_id,r.customer_id,r.rating,r.body,r.created_at,r.updated_at,u.name AS customer_name FROM reviews r JOIN users u ON u.id=r.customer_id WHERE r.vehicle_id=? ORDER BY r.created_at DESC,r.id DESC',
      )
      .all(vehicle.id);
    res.json({ ...vehicle, reviews, reservations: db.prepare(reservedSql).all(vehicle.id) });
  });
  app.get('/api/vehicles/:id/availability', (req, res) => {
    const vehicle = findVehicle(db, req.params.id);
    res.json(availability(db, vehicle, req.query.start, req.query.end));
  });
  app.post('/api/vehicles', requireRole('owner'), (req, res) => {
    const data = vehicleInput(req.body, null, config.uploadDir, req.user.id);
    const values = Object.values(data);
    const id = Number(
      db
        .prepare(
          `INSERT INTO vehicles (owner_id,${Object.keys(data).join(',')}) VALUES (${['?', ...values.map(() => '?')].join(',')})`,
        )
        .run(req.user.id, ...values).lastInsertRowid,
    );
    res.status(201).json(findVehicle(db, id));
  });
  app.patch('/api/vehicles/:id', requireRole('owner'), (req, res) => {
    const previous = ownedVehicle(db, req.params.id, req.user.id);
    if (Object.keys(req.body).length === 1 && typeof req.body.available === 'boolean') {
      db.prepare('UPDATE vehicles SET available=? WHERE id=?').run(
        Number(req.body.available),
        previous.id,
      );
    } else {
      const data = vehicleInput(req.body, previous, config.uploadDir, req.user.id);
      db.prepare(
        `UPDATE vehicles SET ${Object.keys(data)
          .map((key) => `${key}=?`)
          .join(',')} WHERE id=?`,
      ).run(...Object.values(data), previous.id);
    }
    res.json(findVehicle(db, previous.id));
  });
  app.delete('/api/vehicles/:id', requireRole('owner'), (req, res) => {
    transaction(db, () => {
      const vehicle = ownedVehicle(db, req.params.id, req.user.id);
      if (
        db
          .prepare(
            "SELECT id FROM bookings WHERE vehicle_id=? AND status IN ('requested','approved','handed_over')",
          )
          .get(vehicle.id)
      )
        fail('This vehicle has active bookings. Complete or resolve them before deleting.', 409);
      // ponytail: archival deletion keeps rental history and invoice references intact.
      db.prepare('UPDATE vehicles SET archived=1,available=0 WHERE id=?').run(vehicle.id);
    });
    res.json({ ok: true });
  });
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 8, fields: 0 },
    fileFilter: (req, file, callback) => {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
        return callback(
          Object.assign(new Error('Choose JPEG, PNG or WebP images only.'), { status: 400 }),
        );
      }
      callback(null, true);
    },
  });
  app.post('/api/uploads', requireRole('owner'), upload.array('images', 8), async (req, res) => {
    if (!req.files?.length) fail('Choose JPEG, PNG or WebP images (up to 5 MB each).');
    const paths = [];
    try {
      for (const file of req.files) {
        const input = sharp(file.buffer, { limitInputPixels: 24000000 });
        const metadata = await input.metadata();
        if (!['jpeg', 'png', 'webp'].includes(metadata.format))
          fail('Only valid JPEG, PNG and WebP images are accepted.');
        const buffer = await input
          .rotate()
          .resize({ width: 1600, height: 1200, fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 85 })
          .toBuffer();
        const filename = `${req.user.id}-${randomBytes(16).toString('hex')}.webp`;
        await writeFile(join(config.uploadDir, filename), buffer, { flag: 'wx' });
        paths.push(`/uploads/${filename}`);
      }
      res.status(201).json({ images: paths });
    } catch (error) {
      await Promise.all(
        paths.map((path) => unlink(join(config.uploadDir, path.split('/').pop())).catch(() => {})),
      );
      if (error.status) throw error;
      fail('One of the files is not a supported image. Choose a valid JPEG, PNG or WebP.');
    }
  });
  app.get('/api/favorites', requireRole('customer'), (req, res) =>
    res.json(
      db
        .prepare(
          `${vehicleSelect} JOIN favorites f ON f.vehicle_id=v.id WHERE f.customer_id=? AND v.archived=0 ORDER BY v.id DESC`,
        )
        .all(req.user.id)
        .map(vehicleJson),
    ),
  );
  app.get('/api/favorite-ids', requireRole('customer'), (req, res) =>
    res.json(
      db
        .prepare('SELECT vehicle_id FROM favorites WHERE customer_id=?')
        .all(req.user.id)
        .map((x) => x.vehicle_id),
    ),
  );
  app.put('/api/favorites/:id', requireRole('customer'), (req, res) => {
    const vehicle = findVehicle(db, req.params.id);
    db.prepare('INSERT OR IGNORE INTO favorites VALUES (?,?)').run(req.user.id, vehicle.id);
    res.json({ ok: true });
  });
  app.delete('/api/favorites/:id', requireRole('customer'), (req, res) => {
    db.prepare('DELETE FROM favorites WHERE customer_id=? AND vehicle_id=?').run(
      req.user.id,
      idValue(req.params.id),
    );
    res.json({ ok: true });
  });
}
