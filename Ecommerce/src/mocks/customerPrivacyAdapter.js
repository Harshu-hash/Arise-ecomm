import { AxiosError } from 'axios';
const LATENCY_MS = 200;
let preferences;
let exportRequest;
let deletionRequest;
let blockers;
const initialPreferences = () => ({
  orderUpdatesPush: true,
  orderUpdatesEmail: true,
  orderUpdatesSms: true,
  offersPush: true,
  offersEmail: false,
  offersSms: false,
  recommendationsPush: true,
  updatedAt: '2026-08-01T00:00:00.000Z',
});
const initialBlockers = () => [
  {
    code: 'ACTIVE_ORDERS',
    message: 'Wait until your active orders are delivered or cancelled.',
    resolvesAt: null,
  },
];
export const resetCustomerPrivacyFixture = () => {
  preferences = initialPreferences();
  exportRequest = null;
  deletionRequest = null;
  blockers = initialBlockers();
};
resetCustomerPrivacyFixture();
export const setDeletionBlockersFixture = value => {
  blockers = value;
};
const wait = () => new Promise(resolve => setTimeout(resolve, LATENCY_MS));
const response = (config, data, status = 200) => ({
  data,
  status,
  statusText: status < 400 ? 'OK' : 'Error',
  headers: { 'content-type': 'application/json' },
  config,
  request: null,
});
const reject = (config, status, code, message) => {
  throw new AxiosError(
    message,
    code,
    config,
    null,
    response(config, { error: { code, message } }, status),
  );
};
const eligibility = () => ({
  eligible: blockers.length === 0,
  blockers,
  existingRequest: deletionRequest,
});
export const customerPrivacyFixtureAdapter = async config => {
  await wait();
  if (config.url === '/me/communication-preferences' && config.method === 'get')
    return response(config, { data: preferences });
  if (config.url === '/me/communication-preferences' && config.method === 'patch') {
    const allowed = [
      'orderUpdatesPush',
      'orderUpdatesEmail',
      'orderUpdatesSms',
      'offersPush',
      'offersEmail',
      'offersSms',
      'recommendationsPush',
    ];
    for (const [key, value] of Object.entries(config.data || {}))
      if (!allowed.includes(key) || typeof value !== 'boolean')
        return reject(
          config,
          422,
          'PREFERENCES_INVALID',
          'A communication preference was invalid.',
        );
    preferences = { ...preferences, ...config.data, updatedAt: new Date().toISOString() };
    return response(config, { data: preferences });
  }
  if (config.url === '/privacy/export-request' && config.method === 'get')
    return response(config, { data: exportRequest });
  if (config.url === '/privacy/export-request' && config.method === 'post') {
    if (exportRequest && ['REQUESTED', 'PREPARING', 'READY'].includes(exportRequest.status))
      return response(config, { data: exportRequest });
    const requestedAt = new Date(),
      readyBy = new Date(requestedAt.getTime() + 48 * 3600000);
    exportRequest = {
      id: `export-${Date.now()}`,
      status: 'REQUESTED',
      requestedAt: requestedAt.toISOString(),
      readyBy: readyBy.toISOString(),
      downloadUrl: null,
      expiresAt: null,
    };
    return response(config, { data: exportRequest }, 201);
  }
  if (config.url === '/privacy/deletion-eligibility' && config.method === 'get')
    return response(config, { data: eligibility() });
  if (config.url === '/privacy/deletion-request' && config.method === 'post') {
    if (blockers.length)
      return reject(
        config,
        409,
        'ACCOUNT_DELETION_BLOCKED',
        'Resolve the listed account blockers before requesting deletion.',
      );
    if (!config.data?.reasonCode || config.data?.acknowledged !== true)
      return reject(
        config,
        422,
        'DELETION_CONFIRMATION_REQUIRED',
        'Choose a reason and confirm the deletion request.',
      );
    if (!deletionRequest) {
      const requestedAt = new Date();
      deletionRequest = {
        id: `deletion-${Date.now()}`,
        status: 'SCHEDULED',
        requestedAt: requestedAt.toISOString(),
        scheduledDeletionAt: new Date(requestedAt.getTime() + 7 * 86400000).toISOString(),
      };
    }
    return response(config, { data: eligibility() }, 201);
  }
  return reject(
    config,
    501,
    'FIXTURE_NOT_IMPLEMENTED',
    `No fixture exists for ${config.method?.toUpperCase()} ${config.url}.`,
  );
};
