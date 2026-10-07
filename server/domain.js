import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(scryptCallback);
export const TYPES = ['Car', 'SUV', 'Bike', 'Van'];
export const ACTIVE = ['requested', 'approved', 'handed_over'];
export function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}
export function today() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
export function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value &&
    value >= '2000-01-01' &&
    value <= '2100-12-31'
  );
}
export function rentalDays(start, end, allowPast = false) {
  if (!validDate(start) || !validDate(end)) fail('Enter valid pickup and return dates.');
  if (!allowPast && start < today()) fail('Pickup cannot be in the past.');
  const days = (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000;
  if (days < 1 || days > 365) fail('Choose a return date after pickup, within 365 days.');
  return days;
}
export function textValue(value, label, min = 1, max = 200) {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max)
    fail(`${label} must be ${min}–${max} characters.`);
  return value.trim();
}
export function idValue(value) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) fail('Invalid ID.');
  return id;
}
export function moneyValue(value, label = 'Daily price') {
  if (
    (typeof value !== 'number' && typeof value !== 'string') ||
    !/^\d+(\.\d{1,2})?$/.test(String(value))
  )
    fail(`${label} must be a positive amount with up to two decimals.`);
  const amount = Math.round(Number(value) * 100);
  if (!Number.isSafeInteger(amount) || amount < 100 || amount > 100000000)
    fail(`${label} must be between ₹1 and ₹10,00,000.`);
  return amount;
}
export function couponDiscount(coupon, subtotal, date = today()) {
  if (!coupon || !coupon.enabled || date < coupon.starts || date > coupon.ends)
    fail('This coupon is invalid or has expired.');
  if (subtotal < coupon.minimum)
    fail(
      `This coupon needs a rental subtotal of at least ₹${(coupon.minimum / 100).toLocaleString('en-IN')}.`,
    );
  const discount =
    coupon.kind === 'percent' ? Math.floor((subtotal * coupon.value) / 100) : coupon.value;
  return Math.min(discount, subtotal);
}
export function tokenHash(token) {
  return createHash('sha256').update(token).digest('hex');
}
export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = await scrypt(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `scrypt:${salt}:${hash.toString('hex')}`;
}
export async function verifyPassword(password, stored) {
  if (!stored || !stored.startsWith('scrypt:')) return false;
  const [, salt, hash] = stored.split(':');
  const derived = await scrypt(password, salt, 64, {
    N: 32768,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });
  const expected = Buffer.from(hash, 'hex');
  return expected.length === derived.length && timingSafeEqual(derived, expected);
}
export function passwordValue(value) {
  if (typeof value !== 'string' || value.length < 10 || value.length > 128)
    fail('Password must be 10–128 characters.');
  return value;
}
export function emailValue(value) {
  const email = textValue(value, 'Email', 3, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('Enter a valid email address.');
  return email;
}
export function transaction(db, work) {
  // ponytail: synchronous SQLite transaction suits this local demo; use PostgreSQL for sustained multi-server traffic.
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = work();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
