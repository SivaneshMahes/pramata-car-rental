import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  rentalDays,
  validDate,
  moneyValue,
  couponDiscount,
  hashPassword,
  verifyPassword,
} from '../server/domain.js';
test('date ranges count whole calendar days and reject malformed, inverted or excessive ranges', () => {
  assert.equal(rentalDays('2028-02-28', '2028-03-01', true), 2);
  assert.equal(rentalDays('2027-12-31', '2028-01-01', true), 1);
  assert.equal(validDate('2027-02-29'), false);
  assert.equal(validDate('2028-02-29'), true);
  for (const [s, e] of [
    ['2028-01-01', '2028-01-01'],
    ['2028-01-02', '2028-01-01'],
    ['2028-02-30', '2028-03-03'],
    ['2028-01-01', '2030-01-01'],
    ['2028-1-1', '2028-02-01'],
  ])
    assert.throws(() => rentalDays(s, e, true));
  assert.throws(() => rentalDays('2001-01-01', '2001-01-02'));
});
test('money and coupons use integer paise with predictable rounding and limits', () => {
  assert.equal(moneyValue('123.45'), 12345);
  assert.equal(moneyValue('1'), 100);
  for (const value of ['0', '-1', '1.001', 'NaN', '1e3', null, '1000001'])
    assert.throws(() => moneyValue(value));
  const coupon = {
    enabled: 1,
    starts: '2026-01-01',
    ends: '2026-12-31',
    kind: 'percent',
    value: 10,
    minimum: 100,
  };
  assert.equal(couponDiscount(coupon, 10005, '2026-10-07'), 1000);
  assert.equal(
    couponDiscount({ ...coupon, kind: 'fixed', value: 999999 }, 10005, '2026-10-07'),
    10005,
  );
  assert.throws(() => couponDiscount(coupon, 99, '2026-10-07'));
  assert.throws(() => couponDiscount(coupon, 10005, '2027-01-01'));
});
test('password hashes are salted and never store plaintext', async () => {
  const a = await hashPassword('SecurePassword2026!'),
    b = await hashPassword('SecurePassword2026!');
  assert.notEqual(a, b);
  assert.ok(!a.includes('SecurePassword'));
  assert.equal(await verifyPassword('SecurePassword2026!', a), true);
  assert.equal(await verifyPassword('wrong', a), false);
});
