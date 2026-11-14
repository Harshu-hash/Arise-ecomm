import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../../config/env.js';

// Short-lived access to one private file, for plain <img src>/<a href> tags that cannot
// carry an Authorization header. The token is scoped to the exact key and expires fast,
// so leaking a URL (a screenshot, a shared tab) exposes far less than a long-lived link.
function sign(key, exp) {
  return createHmac('sha256', env.JWT_ACCESS_SECRET).update(`${key}.${exp}`).digest('base64url');
}

export function signFileToken(key, ttlSeconds = 300) {
  const exp = Date.now() + ttlSeconds * 1000;
  return `${exp}.${sign(key, exp)}`;
}

export function verifyFileToken(key, token) {
  const [expRaw, signature] = String(token ?? '').split('.');
  const exp = Number(expRaw);
  if (!exp || !signature || Date.now() > exp) return false;
  const expected = Buffer.from(sign(key, exp));
  const given = Buffer.from(signature);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
