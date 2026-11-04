import { resetCustomerAddressFixture } from './customerAddressAdapter';
import { customerOrdersFixtureAdapter, resetCustomerOrdersFixture } from './customerOrdersAdapter';

describe('customerOrdersFixtureAdapter', () => {
  beforeEach(() => {
    resetCustomerAddressFixture();
    resetCustomerOrdersFixture();
  });

  it('filters and paginates order history', async () => {
    const delivered = await customerOrdersFixtureAdapter({
      url: '/orders',
      method: 'get',
      params: { statusGroup: 'Delivered', limit: 1 },
    });
    expect(delivered.data.data.items).toHaveLength(1);
    expect(delivered.data.data.items[0].status).toBe('DELIVERED');
    expect(delivered.data.data.nextCursor).toBe('1');
  });

  it('loads order detail and timeline by stable order ID', async () => {
    const detail = await customerOrdersFixtureAdapter({ url: '/orders/ORD-84920', method: 'get' });
    const timeline = await customerOrdersFixtureAdapter({
      url: '/orders/ORD-84920/timeline',
      method: 'get',
    });
    expect(detail.data.data.id).toBe('ORD-84920');
    expect(timeline.data.data.items.some(event => event.active)).toBe(true);
  });

  it('cancels an eligible order and rejects repeated cancellation', async () => {
    const cancelled = await customerOrdersFixtureAdapter({
      url: '/orders/ORD-84920/cancel',
      method: 'post',
      data: { reason: 'Changed my mind' },
    });
    expect(cancelled.data.data.status).toBe('CANCELLED');
    await expect(
      customerOrdersFixtureAdapter({
        url: '/orders/ORD-84920/cancel',
        method: 'post',
        data: { reason: 'Changed my mind' },
      }),
    ).rejects.toMatchObject({
      response: { status: 409, data: { error: { code: 'ORDER_NOT_CANCELLABLE' } } },
    });
  });

  it('returns a recoverable error for an invalid order deep link', async () => {
    await expect(
      customerOrdersFixtureAdapter({ url: '/orders/ORD-MISSING', method: 'get' }),
    ).rejects.toMatchObject({
      response: { status: 404, data: { error: { code: 'ORDER_NOT_FOUND' } } },
    });
  });
});
