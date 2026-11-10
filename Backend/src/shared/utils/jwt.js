import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { UnauthorizedError } from '../errors/AppError.js';

const base = { algorithm: 'HS256', issuer: env.JWT_ISSUER, audience: env.JWT_AUDIENCE };

function secretFor(kind) {
  const value = kind === 'access' ? env.JWT_ACCESS_SECRET : env.JWT_REFRESH_SECRET;
  if (!value) throw new Error(`JWT_${kind.toUpperCase()}_SECRET is not configured`);
  return value;
}

// claims: { sub, role, sellerId? }. Refresh tokens carry a session id (sid) so they can be rotated/revoked.
export function signAccessToken(claims) {
  return jwt.sign({ ...claims, typ: 'access' }, secretFor('access'), { ...base, expiresIn: env.JWT_ACCESS_TTL });
}

export function signRefreshToken({ sub, sid, jti }) {
  return jwt.sign({ sub, sid, typ: 'refresh' }, secretFor('refresh'), {
    ...base,
    jwtid: jti,
    expiresIn: env.JWT_REFRESH_TTL,
  });
}

function verify(kind, token) {
  try {
    const claims = jwt.verify(token, secretFor(kind), {
      algorithms: ['HS256'],
      issuer: base.issuer,
      audience: base.audience,
    });
    if (claims.typ !== kind) throw new Error('wrong token type');
    return claims;
  } catch {
    throw new UnauthorizedError('Invalid or expired token.');
  }
}

export const verifyAccessToken = (token) => verify('access', token);
export const verifyRefreshToken = (token) => verify('refresh', token);
