import { env } from '../../config/env.js';

const COOKIE_NAME = 'refresh_token';

// Browser panels (admin/seller) keep the refresh token in an HttpOnly cookie, never in JS-readable storage.
// `path` should be the audience's auth prefix (e.g. /api/admin/v1/auth) so it is sent only to auth routes.
export function setRefreshCookie(res, token, expiresAt, path) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'strict',
    path,
    expires: expiresAt,
  });
}

export const clearRefreshCookie = (res, path) => res.clearCookie(COOKIE_NAME, { path });

export function readRefreshCookie(req) {
  const header = req.get('cookie') ?? '';
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === COOKIE_NAME) return decodeURIComponent(rest.join('='));
  }
  return null;
}
