import { AppError } from '../errors/AppError.js';
import { verifyStepUpToken } from '../utils/jwt.js';

// Mount AFTER authenticate: the X-Step-Up-Token must be a fresh re-auth token of the same user.
export function requireStepUp(req, _res, next) {
  try {
    if (verifyStepUpToken(req.get('x-step-up-token') ?? '').sub !== req.auth.userId) throw new Error('subject mismatch');
    next();
  } catch {
    next(new AppError({ code: 'STEP_UP_REQUIRED', status: 403, message: 'Confirm your password to continue.' }));
  }
}
