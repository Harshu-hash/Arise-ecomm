import {
  mapDeviceRegistration,
  mapNotificationPreferences,
  mapNotifications,
} from './notifications.mapper';
const item = {
  id: 'notification-1',
  deduplicationKey: 'order:1',
  category: 'ORDER',
  title: 'Order update',
  body: 'Your order changed.',
  createdAt: '2026-11-03T06:30:00.000Z',
  readAt: null,
  target: { type: 'ORDER', entityId: 'ORD-1' },
};
describe('notification mappers', () => {
  it('maps validated inbox presentation state', () => {
    const result = mapNotifications({
      data: { items: [item], unreadCount: 1, total: 1, nextCursor: null },
    });
    expect(result.items[0]).toMatchObject({
      read: false,
      icon: 'package',
      message: 'Your order changed.',
    });
  });
  it('validates preference permission state', () => {
    expect(
      mapNotificationPreferences({
        data: {
          orders: true,
          delivery: true,
          offers: false,
          account: true,
          support: true,
          pushPermission: 'DENIED',
          updatedAt: '2026-11-03T00:00:00.000Z',
        },
      }).pushPermission,
    ).toBe('DENIED');
  });
  it('validates device registrations', () => {
    expect(mapDeviceRegistration({ data: { registered: true, deviceId: 'device-1' } })).toEqual({
      registered: true,
      deviceId: 'device-1',
    });
  });
  it('rejects arbitrary navigation targets', () => {
    expect(() =>
      mapNotifications({
        data: {
          items: [{ ...item, target: { type: 'URL', entityId: 'https://evil.example' } }],
          unreadCount: 1,
          total: 1,
          nextCursor: null,
        },
      }),
    ).toThrow();
  });
});
