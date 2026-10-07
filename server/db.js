import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
export function openDatabase(path = process.env.DATABASE_PATH || './data/rental.sqlite') {
  if (path !== ':memory:') mkdirSync(dirname(resolve(path)), { recursive: true });
  const db = new DatabaseSync(path, { timeout: 5000 });
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT, role TEXT NOT NULL CHECK(role IN ('customer','owner')),
      google_id TEXT UNIQUE, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS sessions (
      hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      csrf TEXT NOT NULL, expires INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS oauth_states (
      hash TEXT PRIMARY KEY, role TEXT NOT NULL CHECK(role IN ('customer','owner')), nonce TEXT NOT NULL,
      expires INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS vehicles (
      id INTEGER PRIMARY KEY, owner_id INTEGER NOT NULL REFERENCES users(id), name TEXT NOT NULL,
      summary TEXT NOT NULL, description TEXT NOT NULL, type TEXT NOT NULL CHECK(type IN ('Car','SUV','Bike','Van')),
      registration TEXT NOT NULL UNIQUE COLLATE NOCASE, daily_price INTEGER NOT NULL CHECK(daily_price > 0),
      location TEXT NOT NULL, available INTEGER NOT NULL DEFAULT 1 CHECK(available IN (0,1)),
      features TEXT NOT NULL DEFAULT '[]', images TEXT NOT NULL DEFAULT '[]', archived INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS coupons (
      code TEXT PRIMARY KEY COLLATE NOCASE, kind TEXT NOT NULL CHECK(kind IN ('percent','fixed')),
      value INTEGER NOT NULL CHECK(value > 0), minimum INTEGER NOT NULL DEFAULT 0,
      starts TEXT NOT NULL, ends TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY, vehicle_id INTEGER NOT NULL REFERENCES vehicles(id),
      customer_id INTEGER NOT NULL REFERENCES users(id), start_date TEXT NOT NULL, end_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'requested' CHECK(status IN ('requested','approved','rejected','handed_over','returned','cancelled')),
      daily_price INTEGER NOT NULL CHECK(daily_price > 0), days INTEGER NOT NULL CHECK(days > 0),
      subtotal INTEGER NOT NULL, discount INTEGER NOT NULL DEFAULT 0, total INTEGER NOT NULL,
      coupon TEXT, snapshot TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CHECK(end_date > start_date), CHECK(subtotal = daily_price * days),
      CHECK(discount >= 0 AND discount <= subtotal), CHECK(total = subtotal - discount)
    );
    CREATE INDEX IF NOT EXISTS booking_availability ON bookings(vehicle_id, start_date, end_date, status);
    CREATE INDEX IF NOT EXISTS booking_customer ON bookings(customer_id, status);
    CREATE INDEX IF NOT EXISTS vehicle_owner ON vehicles(owner_id, archived);
    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY, booking_id INTEGER NOT NULL UNIQUE REFERENCES bookings(id),
      vehicle_id INTEGER NOT NULL REFERENCES vehicles(id), customer_id INTEGER NOT NULL REFERENCES users(id),
      rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5), body TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS review_vehicle ON reviews(vehicle_id);
    CREATE TABLE IF NOT EXISTS favorites (
      customer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      vehicle_id INTEGER NOT NULL REFERENCES vehicles(id), PRIMARY KEY(customer_id, vehicle_id)
    );
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      booking_id INTEGER REFERENCES bookings(id), message TEXT NOT NULL, seen INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS notification_user ON notifications(user_id, id);
    CREATE TRIGGER IF NOT EXISTS no_overlapping_booking_insert BEFORE INSERT ON bookings
    WHEN NEW.status IN ('requested','approved','handed_over') BEGIN
      SELECT RAISE(ABORT, 'booking_overlap') WHERE EXISTS (
        SELECT 1 FROM bookings WHERE vehicle_id = NEW.vehicle_id
        AND status IN ('requested','approved','handed_over')
        AND start_date < NEW.end_date AND end_date > NEW.start_date
      );
    END;
    CREATE TRIGGER IF NOT EXISTS no_overlapping_booking_update BEFORE UPDATE OF start_date,end_date,status,vehicle_id ON bookings
    WHEN NEW.status IN ('requested','approved','handed_over') BEGIN
      SELECT RAISE(ABORT, 'booking_overlap') WHERE EXISTS (
        SELECT 1 FROM bookings WHERE vehicle_id = NEW.vehicle_id AND id != NEW.id
        AND status IN ('requested','approved','handed_over')
        AND start_date < NEW.end_date AND end_date > NEW.start_date
      );
    END;
  `);
  // Additive migration preserves existing rentals and accounts.
  const userColumns = new Set(
    db
      .prepare('PRAGMA table_info(users)')
      .all()
      .map((c) => c.name),
  );
  for (const column of ['phone', 'city', 'bio']) {
    if (!userColumns.has(column))
      db.exec(`ALTER TABLE users ADD COLUMN ${column} TEXT NOT NULL DEFAULT ''`);
  }
  const oauthColumns = new Set(
    db
      .prepare('PRAGMA table_info(oauth_states)')
      .all()
      .map((c) => c.name),
  );
  if (!oauthColumns.has('return_route'))
    db.exec("ALTER TABLE oauth_states ADD COLUMN return_route TEXT NOT NULL DEFAULT ''");
  return db;
}
export const vehicleSelect = `SELECT v.*, u.name AS owner_name,
  COALESCE((SELECT AVG(r.rating) FROM reviews r WHERE r.vehicle_id=v.id),0) AS rating,
  (SELECT COUNT(*) FROM reviews r WHERE r.vehicle_id=v.id) AS review_count
  FROM vehicles v JOIN users u ON u.id=v.owner_id`;
export function vehicleJson(row) {
  return {
    ...row,
    available: !!row.available,
    images: JSON.parse(row.images),
    features: JSON.parse(row.features),
  };
}
