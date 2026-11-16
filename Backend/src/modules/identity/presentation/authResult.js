import { setRefreshCookie } from '../../../shared/http/refreshCookie.js';
import { sendCommand } from '../../../shared/http/respond.js';

export const deviceOf = (req) => ({ userAgent: req.get('user-agent') ?? null, ip: req.ip, label: null });

// Shared by every endpoint that can end in a login-shaped outcome (login, invite-accept):
// either a 2FA challenge to continue, or a session plus the access token.
export function sendAuthResult(res, cookiePath, result) {
  if (result.stage === 'enrol_2fa') {
    const { stage, challengeId, secret, otpauthUrl } = result;
    return sendCommand(res, { stage, challengeId, secret, otpauthUrl });
  }
  if (result.stage === 'verify_2fa') {
    const { stage, challengeId, maskedEmail } = result;
    return sendCommand(res, { stage, challengeId, maskedEmail });
  }
  setRefreshCookie(res, result.tokens.refreshToken, result.tokens.refreshExpiresAt, cookiePath);
  const body = { accessToken: result.tokens.accessToken, user: result.user };
  if (result.backupCodes) body.backupCodes = result.backupCodes;
  return sendCommand(res, body);
}
