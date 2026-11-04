import { AxiosError } from 'axios';
const LATENCY_MS = 180;
let notifications;
let preferences;
const devices = new Map();
const seed = () => [
  {
    id: 'notification-1',
    deduplicationKey: 'order:ORD-84920:processing',
    category: 'ORDER',
    title: 'Order is being prepared',
    body: 'Order ORD-84920 is being prepared by the seller.',
    createdAt: '2026-11-03T06:30:00.000Z',
    readAt: null,
    target: { type: 'ORDER', entityId: 'ORD-84920' },
  },
  {
    id: 'notification-2',
    deduplicationKey: 'delivery:ORD-77213:delivered',
    category: 'DELIVERY',
    title: 'Order delivered',
    body: 'Order ORD-77213 was delivered successfully.',
    createdAt: '2026-11-02T09:15:00.000Z',
    readAt: '2026-11-02T10:00:00.000Z',
    target: { type: 'ORDER', entityId: 'ORD-77213' },
  },
  {
    id: 'notification-3',
    deduplicationKey: 'offer:festival-2026',
    category: 'OFFER',
    title: 'Festival offers are live',
    body: 'Explore eligible offers in the app.',
    createdAt: '2026-11-01T05:00:00.000Z',
    readAt: null,
    target: { type: 'NONE', entityId: null },
  },
  {
    id: 'notification-4',
    deduplicationKey: 'support:ticket-101',
    category: 'SUPPORT',
    title: 'Support replied',
    body: 'There is a new reply on your support request.',
    createdAt: '2026-10-31T13:20:00.000Z',
    readAt: null,
    target: { type: 'TICKET', entityId: 'ticket-101' },
  },
];
export const resetCustomerNotificationsFixture = () => {
  notifications = seed();
  preferences = {
    orders: true,
    delivery: true,
    offers: true,
    account: true,
    support: true,
    pushPermission: 'NOT_DETERMINED',
    updatedAt: '2026-11-01T00:00:00.000Z',
  };
  devices.clear();
};
resetCustomerNotificationsFixture();
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
export const customerNotificationsFixtureAdapter = async config => {
  await wait();
  if (config.url === '/notifications' && config.method === 'get') {
    const unique = [...new Map(notifications.map(item => [item.deduplicationKey, item])).values()],
      offset = Number(config.params?.cursor || 0),
      limit = Math.min(Number(config.params?.limit || 20), 50),
      items = unique.slice(offset, offset + limit);
    return response(config, {
      data: {
        items,
        unreadCount: unique.filter(item => !item.readAt).length,
        total: unique.length,
        nextCursor: offset + limit < unique.length ? String(offset + limit) : null,
      },
    });
  }
  if (config.url === '/notifications/read-all' && config.method === 'put') {
    const readAt = new Date().toISOString();
    notifications = notifications.map(item => (item.readAt ? item : { ...item, readAt }));
    return response(config, { data: { updated: true } });
  }
  const readMatch = config.url?.match(/^\/notifications\/([^/]+)\/read$/);
  if (readMatch && config.method === 'put') {
    const index = notifications.findIndex(item => item.id === decodeURIComponent(readMatch[1]));
    if (index < 0)
      return reject(config, 404, 'NOTIFICATION_NOT_FOUND', 'This notification was not found.');
    if (!notifications[index].readAt)
      notifications[index] = { ...notifications[index], readAt: new Date().toISOString() };
    return response(config, { data: notifications[index] });
  }
  if (config.url === '/notifications/preferences' && config.method === 'get')
    return response(config, { data: preferences });
  if (config.url === '/notifications/preferences' && config.method === 'patch') {
    const allowed = ['orders', 'delivery', 'offers', 'account', 'support', 'pushPermission'];
    for (const [key, value] of Object.entries(config.data || {})) {
      if (!allowed.includes(key))
        return reject(config, 422, 'PREFERENCES_INVALID', 'A notification preference was invalid.');
      if (
        key === 'pushPermission'
          ? !['NOT_DETERMINED', 'GRANTED', 'DENIED'].includes(value)
          : typeof value !== 'boolean'
      )
        return reject(config, 422, 'PREFERENCES_INVALID', 'A notification preference was invalid.');
    }
    preferences = { ...preferences, ...config.data, updatedAt: new Date().toISOString() };
    return response(config, { data: preferences });
  }
  if (config.url === '/devices/push-tokens' && config.method === 'post') {
    const { deviceId, token, platform } = config.data || {};
    if (!deviceId || !token || !['android', 'ios'].includes(platform))
      return reject(config, 422, 'DEVICE_TOKEN_INVALID', 'Device registration data is invalid.');
    devices.set(deviceId, { token, platform });
    return response(config, { data: { registered: true, deviceId } }, 201);
  }
  const deviceMatch = config.url?.match(/^\/devices\/push-tokens\/([^/]+)$/);
  if (deviceMatch && config.method === 'delete') {
    const deviceId = decodeURIComponent(deviceMatch[1]);
    devices.delete(deviceId);
    return response(config, { data: { registered: false, deviceId } });
  }
  return reject(
    config,
    501,
    'FIXTURE_NOT_IMPLEMENTED',
    `No fixture exists for ${config.method?.toUpperCase()} ${config.url}.`,
  );
};
export const getRegisteredPushDevicesFixture = () => new Map(devices);
