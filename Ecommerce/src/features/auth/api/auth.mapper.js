import {
  apiEnvelope,
  authChallengeSchema,
  passwordResetResultSchema,
  passwordResetVerificationSchema,
  sessionSchema,
} from './auth.schemas';

const unwrap = (payload, schema) => apiEnvelope(schema).parse(payload).data;

export const mapAuthChallenge = payload => unwrap(payload, authChallengeSchema);

export const mapSession = payload => {
  const session = unwrap(payload, sessionSchema);
  return {
    ...session,
    user: {
      ...session.user,
      displayName:
        session.user.name || session.user.phone || session.user.email || 'Arise customer',
    },
  };
};

export const mapPasswordResetVerification = payload =>
  unwrap(payload, passwordResetVerificationSchema);

export const mapPasswordResetResult = payload => unwrap(payload, passwordResetResultSchema);
