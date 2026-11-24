import { safeIdempotencyKey } from './idempotency';

const VALID = /^[A-Za-z0-9_.:-]{8,128}$/;

describe('safeIdempotencyKey', () => {
  test('a variant name with a slash or spaces still makes a key the server accepts', () => {
    expect(safeIdempotencyKey('checkout:6b0494d1:8/128:1:addr1')).toMatch(VALID);
    expect(safeIdempotencyKey('checkout:p1:Red, M:2:a1')).toMatch(VALID);
  });
  test('the same input gives the same key, different input a different one', () => {
    expect(safeIdempotencyKey('checkout:a:8/128:1')).toBe(safeIdempotencyKey('checkout:a:8/128:1'));
    expect(safeIdempotencyKey('checkout:a:8/128:1')).not.toBe(safeIdempotencyKey('checkout:a:8/256:1'));
  });
  test('a very long key is shortened but keeps telling inputs apart', () => {
    const long = (tail) => `checkout:${'p'.repeat(200)}:${tail}`;
    expect(safeIdempotencyKey(long('1'))).toMatch(VALID);
    expect(safeIdempotencyKey(long('1'))).not.toBe(safeIdempotencyKey(long('2')));
  });
  test('a key already valid is left alone; a tiny one is padded to the minimum', () => {
    expect(safeIdempotencyKey('payment:abc123:upi')).toBe('payment:abc123:upi');
    expect(safeIdempotencyKey('ab')).toMatch(VALID);
  });
});
