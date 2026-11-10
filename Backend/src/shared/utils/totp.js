import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

// RFC 6238 TOTP (SHA-1, 6 digits, 30s) for admin MFA. Store the secret encrypted (encryptField).
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const STEP_SECONDS = 30;

function base32Encode(buffer) {
  let bits = '';
  for (const byte of buffer) bits += byte.toString(2).padStart(8, '0');
  return (bits.match(/.{1,5}/g) ?? []).map((chunk) => ALPHABET[Number.parseInt(chunk.padEnd(5, '0'), 2)]).join('');
}

function base32Decode(text) {
  const bits = [...text.replace(/=+$/, '').toUpperCase()].map((c) => ALPHABET.indexOf(c).toString(2).padStart(5, '0')).join('');
  return Buffer.from((bits.match(/.{8}/g) ?? []).map((byte) => Number.parseInt(byte, 2)));
}

export const generateTotpSecret = () => base32Encode(randomBytes(20));

export const totpUri = ({ secret, account, issuer }) =>
  `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}`;

function codeAt(secret, step) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = createHmac('sha1', base32Decode(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const value = hmac.readUInt32BE(offset) & 0x7fffffff;
  return String(value % 1_000_000).padStart(6, '0');
}

// Returns the matched time-step (store it as lastUsedStep and reject <= that value to block replay) or null.
export function verifyTotp(secret, code, { window = 1, now = Date.now() } = {}) {
  const current = Math.floor(now / 1000 / STEP_SECONDS);
  const given = Buffer.from(String(code));
  for (let step = current - window; step <= current + window; step += 1) {
    const expected = Buffer.from(codeAt(secret, step));
    if (expected.length === given.length && timingSafeEqual(expected, given)) return step;
  }
  return null;
}

export const totpCodeAt = (secret, now = Date.now()) => codeAt(secret, Math.floor(now / 1000 / STEP_SECONDS));
