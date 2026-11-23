import { createSign } from 'node:crypto';
import { env } from '../../../config/env.js';
import { logger } from '../../../config/logger.js';

// Firebase Cloud Messaging adapter (HTTP v1), no SDK: a service-account JWT is exchanged for a short-lived Google token,
// which then authorises each send. Not configured (no FCM_SERVICE_ACCOUNT_JSON) means pushes are skipped, never an error.
const SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
let account;
let accessToken = null;
let accessTokenExpiresAt = 0;

function serviceAccount() {
  if (account !== undefined) return account;
  try {
    account = env.FCM_SERVICE_ACCOUNT_JSON ? JSON.parse(env.FCM_SERVICE_ACCOUNT_JSON) : null;
  } catch (err) {
    logger.error({ err }, 'FCM_SERVICE_ACCOUNT_JSON is not valid JSON; push notifications are off');
    account = null;
  }
  return account;
}

const base64url = (value) => Buffer.from(value).toString('base64url');

async function token() {
  if (accessToken && Date.now() < accessTokenExpiresAt - 60_000) return accessToken;
  const { client_email: issuer, private_key: key, token_uri: audience = 'https://oauth2.googleapis.com/token' } = serviceAccount();
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${base64url(JSON.stringify({ iss: issuer, scope: SCOPE, aud: audience, iat: now, exp: now + 3600 }))}`;
  const assertion = `${unsigned}.${createSign('RSA-SHA256').update(unsigned).sign(key).toString('base64url')}`;
  const response = await fetch(audience, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
    signal: AbortSignal.timeout(10_000),
  });
  const body = await response.json();
  if (!response.ok || !body.access_token) throw new Error(`Google token request failed: ${body.error_description ?? response.status}`);
  accessToken = body.access_token;
  accessTokenExpiresAt = Date.now() + body.expires_in * 1000;
  return accessToken;
}

export const fcm = {
  configured: () => Boolean(serviceAccount()),

  /**
   * Sends one push. Returns { sent: true }, or { sent: false, invalidToken: true } when Firebase says this token is dead
   * (the app was uninstalled or the token rotated), so the caller can stop using it. Other failures throw.
   * `data` values must be strings.
   */
  async send({ token: deviceToken, title, body, data = {} }) {
    const { project_id: project } = serviceAccount();
    const response = await fetch(`https://fcm.googleapis.com/v1/projects/${project}/messages:send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: { token: deviceToken, notification: { title, body }, data, android: { priority: 'high' } } }),
      signal: AbortSignal.timeout(10_000),
    });
    if (response.ok) return { sent: true };
    const error = (await response.json().catch(() => null))?.error;
    const code = error?.details?.find((detail) => detail.errorCode)?.errorCode;
    if (response.status === 404 || code === 'UNREGISTERED' || (response.status === 400 && code === 'INVALID_ARGUMENT')) return { sent: false, invalidToken: true };
    throw new Error(`FCM answered ${response.status}: ${error?.message ?? 'unknown error'}`);
  },
};
