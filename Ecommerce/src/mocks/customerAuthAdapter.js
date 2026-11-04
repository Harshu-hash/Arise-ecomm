import { AxiosError } from 'axios';

const FIXTURE_OTP = '1234';
const LATENCY_MS = 250;
const challenges = new Map();
const passwordResetTokens = new Set();

const wait = () => new Promise(resolve => setTimeout(resolve, LATENCY_MS));
const parseBody = data => {
  if (!data) return {};
  return typeof data === 'string' ? JSON.parse(data) : data;
};
const isoAfter = milliseconds => new Date(Date.now() + milliseconds).toISOString();
const token = prefix => `${prefix}_${Date.now().toString(36)}`;
const maskIdentifier = identifier =>
  identifier.includes('@')
    ? identifier.replace(/(^.).*(@.*$)/, '$1***$2')
    : `******${identifier.slice(-4)}`;

const response = (config, data, status = 200) => ({
  data,
  status,
  statusText: status < 400 ? 'OK' : 'Error',
  headers: { 'content-type': 'application/json' },
  config,
  request: null,
});

const reject = (config, status, code, message, fieldErrors) => {
  const result = response(config, { error: { code, message, fieldErrors } }, status);
  throw new AxiosError(message, code, config, null, result);
};

const sessionEnvelope = ({ identifier, name = 'Demo Customer' }) => ({
  data: {
    user: {
      id: 'cus_fixture_1',
      name,
      email: identifier.includes('@') ? identifier : null,
      phone: identifier.includes('@') ? null : identifier,
      status: 'ACTIVE',
    },
    accessToken: token('fixture_access'),
    refreshToken: token('fixture_refresh'),
    expiresAt: isoAfter(15 * 60 * 1000),
  },
});

export const customerAuthFixtureAdapter = async config => {
  await wait();
  const body = parseBody(config.data);
  const path = config.url;

  if (path === '/auth/start' && config.method === 'post') {
    const identifier = String(body.identifier ?? '').trim();
    if (!identifier) {
      return reject(config, 422, 'VALIDATION_FAILED', 'Enter a mobile number or email.', {
        identifier: 'This field is required.',
      });
    }
    const challengeId = token('challenge');
    challenges.set(challengeId, {
      identifier,
      name: String(body.name ?? '').trim() || undefined,
      purpose: body.purpose ?? 'LOGIN',
    });
    return response(config, {
      data: {
        challengeId,
        destinationMasked: maskIdentifier(identifier),
        expiresAt: isoAfter(5 * 60 * 1000),
        resendAvailableAt: isoAfter(30 * 1000),
        purpose: body.purpose ?? 'LOGIN',
        isNewCustomer: false,
      },
    });
  }

  if (path === '/auth/verify-otp' && config.method === 'post') {
    const challenge = challenges.get(body.challengeId);
    if (!challenge) {
      return reject(config, 410, 'OTP_EXPIRED', 'This verification request has expired.');
    }
    if (body.otp !== FIXTURE_OTP) {
      return reject(config, 422, 'OTP_INVALID', 'The verification code is incorrect.');
    }
    challenges.delete(body.challengeId);
    return response(config, sessionEnvelope(challenge));
  }

  if (path === '/auth/password/verify-otp' && config.method === 'post') {
    const challenge = challenges.get(body.challengeId);
    if (!challenge || challenge.purpose !== 'PASSWORD_RESET') {
      return reject(config, 410, 'OTP_EXPIRED', 'This reset request has expired.');
    }
    if (body.otp !== FIXTURE_OTP) {
      return reject(config, 422, 'OTP_INVALID', 'The verification code is incorrect.');
    }
    challenges.delete(body.challengeId);
    const resetToken = token('fixture_password_reset');
    passwordResetTokens.add(resetToken);
    return response(config, {
      data: { resetToken, expiresAt: isoAfter(10 * 60 * 1000) },
    });
  }

  if (path === '/auth/password/reset' && config.method === 'post') {
    if (!passwordResetTokens.has(body.resetToken)) {
      return reject(config, 410, 'RESET_TOKEN_EXPIRED', 'Start password reset again.');
    }
    if (String(body.password ?? '').length < 8) {
      return reject(config, 422, 'VALIDATION_FAILED', 'Use at least 8 characters.', {
        password: 'Password must contain at least 8 characters.',
      });
    }
    passwordResetTokens.delete(body.resetToken);
    return response(config, { data: { success: true } });
  }

  if (path === '/auth/resend-otp' && config.method === 'post') {
    const previous = challenges.get(body.challengeId);
    if (!previous) return reject(config, 410, 'OTP_EXPIRED', 'Start verification again.');
    challenges.delete(body.challengeId);
    const challengeId = token('challenge');
    challenges.set(challengeId, previous);
    return response(config, {
      data: {
        challengeId,
        destinationMasked: maskIdentifier(previous.identifier),
        expiresAt: isoAfter(5 * 60 * 1000),
        resendAvailableAt: isoAfter(30 * 1000),
        purpose: previous.purpose,
        isNewCustomer: false,
      },
    });
  }

  if (path === '/auth/signup' && config.method === 'post') {
    const identifier = String(body.identifier ?? '').trim();
    const name = String(body.name ?? '').trim();
    if (!identifier || !name) {
      return reject(config, 422, 'VALIDATION_FAILED', 'Name and identifier are required.', {
        ...(!name && { name: 'This field is required.' }),
        ...(!identifier && { identifier: 'This field is required.' }),
      });
    }
    return response(config, sessionEnvelope({ identifier, name }));
  }

  if (path === '/auth/refresh' && config.method === 'post') {
    if (!String(body.refreshToken ?? '').startsWith('fixture_refresh_')) {
      return reject(config, 401, 'SESSION_EXPIRED', 'Your session has expired.');
    }
    return response(
      config,
      sessionEnvelope({ identifier: '+919876543210', name: 'Demo Customer' }),
    );
  }

  if (path === '/auth/session' && config.method === 'get') {
    return response(
      config,
      sessionEnvelope({ identifier: '+919876543210', name: 'Demo Customer' }),
    );
  }

  if (['/auth/logout', '/auth/logout-all'].includes(path) && config.method === 'post') {
    return response(config, { data: { loggedOut: true } });
  }

  return reject(
    config,
    501,
    'FIXTURE_NOT_IMPLEMENTED',
    `No fixture exists for ${config.method?.toUpperCase()} ${path}.`,
  );
};

export const CUSTOMER_AUTH_FIXTURE_OTP = FIXTURE_OTP;
