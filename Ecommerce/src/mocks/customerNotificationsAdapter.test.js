import {
  customerNotificationsFixtureAdapter,
  getRegisteredPushDevicesFixture,
  resetCustomerNotificationsFixture,
} from './customerNotificationsAdapter';
describe('customerNotificationsFixtureAdapter', () => {
  beforeEach(resetCustomerNotificationsFixture);
  it('lists deduplicated notifications with unread counts', async () => {
    const response = await customerNotificationsFixtureAdapter({
      url: '/notifications',
      method: 'get',
      params: { limit: 2 },
    });
    expect(response.data.data).toMatchObject({
      items: expect.any(Array),
      unreadCount: 3,
      total: 4,
      nextCursor: '2',
    });
  });
  it('persists single and bulk read state', async () => {
    await customerNotificationsFixtureAdapter({
      url: '/notifications/notification-1/read',
      method: 'put',
    });
    let list = await customerNotificationsFixtureAdapter({
      url: '/notifications',
      method: 'get',
      params: { limit: 20 },
    });
    expect(list.data.data.unreadCount).toBe(2);
    await customerNotificationsFixtureAdapter({ url: '/notifications/read-all', method: 'put' });
    list = await customerNotificationsFixtureAdapter({
      url: '/notifications',
      method: 'get',
      params: { limit: 20 },
    });
    expect(list.data.data.unreadCount).toBe(0);
  });
  it('persists preferences', async () => {
    await customerNotificationsFixtureAdapter({
      url: '/notifications/preferences',
      method: 'patch',
      data: { offers: false, pushPermission: 'DENIED' },
    });
    const response = await customerNotificationsFixtureAdapter({
      url: '/notifications/preferences',
      method: 'get',
    });
    expect(response.data.data).toMatchObject({ offers: false, pushPermission: 'DENIED' });
  });
  it('registers, rotates and unregisters device tokens', async () => {
    await customerNotificationsFixtureAdapter({
      url: '/devices/push-tokens',
      method: 'post',
      data: { deviceId: 'device-1', token: 'token-a', platform: 'android' },
    });
    await customerNotificationsFixtureAdapter({
      url: '/devices/push-tokens',
      method: 'post',
      data: { deviceId: 'device-1', token: 'token-b', platform: 'android' },
    });
    expect(getRegisteredPushDevicesFixture().get('device-1').token).toBe('token-b');
    await customerNotificationsFixtureAdapter({
      url: '/devices/push-tokens/device-1',
      method: 'delete',
    });
    expect(getRegisteredPushDevicesFixture().has('device-1')).toBe(false);
  });
});
