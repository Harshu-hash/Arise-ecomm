import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
import { UnauthorizedError } from '../../../shared/errors/AppError.js';
import { sha256 } from '../../../shared/utils/crypto.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../../shared/utils/jwt.js';
import { AuthSession } from '../infrastructure/persistence/session.model.js';

function issueTokens(session, jti) {
  const refreshToken = signRefreshToken({ sub: session.userId, sid: String(session._id), jti });
  return {
    accessToken: signAccessToken({
      sub: session.userId,
      role: session.role,
      ...(session.sellerId ? { sellerId: session.sellerId } : {}),
    }),
    refreshToken,
    refreshExpiresAt: new Date(jwt.decode(refreshToken).exp * 1000),
  };
}

// Called after credentials/OTP have been verified by the login use-case.
export async function createSession({ userId, role, sellerId = null, device = {} }) {
  const id = new mongoose.Types.ObjectId();
  const jti = randomUUID();
  const draft = { _id: id, userId: String(userId), role, sellerId };
  const tokens = issueTokens(draft, jti);
  await AuthSession.create({
    ...draft,
    refreshHash: sha256(jti),
    device,
    expiresAt: tokens.refreshExpiresAt,
  });
  return tokens;
}

async function revoke(filter, reason) {
  const result = await AuthSession.updateMany(
    { ...filter, revokedAt: null },
    { $set: { revokedAt: new Date(), revokedReason: reason } },
  );
  return result.modifiedCount;
}

// Rotating refresh: every use issues a new token. Presenting an already-used token means theft -> kill the session.
export async function rotateSession(refreshToken) {
  const claims = verifyRefreshToken(refreshToken);
  const session = mongoose.isValidObjectId(claims.sid) ? await AuthSession.findById(claims.sid).lean() : null;
  if (!session || session.revokedAt || session.expiresAt <= new Date() || session.userId !== claims.sub) {
    throw new UnauthorizedError('Session is no longer valid.');
  }

  const presented = sha256(claims.jti);
  if (presented === session.previousHash) {
    await revoke({ _id: session._id }, 'refresh_token_reuse');
    throw new UnauthorizedError('Session is no longer valid.');
  }

  const jti = randomUUID();
  const tokens = issueTokens(session, jti);
  // Compare-and-swap: of two concurrent refreshes with the same token only one wins.
  const updated = await AuthSession.findOneAndUpdate(
    { _id: session._id, refreshHash: presented, revokedAt: null },
    { $set: { refreshHash: sha256(jti), previousHash: presented, lastUsedAt: new Date(), expiresAt: tokens.refreshExpiresAt } },
  );
  if (!updated) throw new UnauthorizedError('Session is no longer valid.');
  return tokens;
}

export const revokeSession = (sessionId, userId) => revoke({ _id: sessionId, userId: String(userId) }, 'logout');
export const revokeAllSessions = (userId) => revoke({ userId: String(userId) }, 'logout_all');
export const listSessions = (userId) =>
  AuthSession.find({ userId: String(userId), revokedAt: null }, 'device lastUsedAt createdAt').sort({ lastUsedAt: -1 }).lean();
