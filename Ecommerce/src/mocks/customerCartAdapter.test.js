import { customerCartFixtureAdapter, resetCustomerCartFixture } from './customerCartAdapter';

describe('customerCartFixtureAdapter', () => {
  beforeEach(resetCustomerCartFixture);

  it('returns server-owned totals and reprices quantity changes', async () => {
    const before = await customerCartFixtureAdapter({ url: '/cart', method: 'get' });
    const item = before.data.data.items[0];
    const after = await customerCartFixtureAdapter({
      url: `/cart/items/${item.cartItemId}`,
      method: 'patch',
      data: { quantity: 2 },
    });

    expect(after.data.data.items[0].quantity).toBe(2);
    expect(after.data.data.totals.subtotalPaise).toBe(item.pricePaise * 2);
  });

  it('moves items to saved-for-later and back', async () => {
    const cart = await customerCartFixtureAdapter({ url: '/cart', method: 'get' });
    const cartItemId = cart.data.data.items[0].cartItemId;
    const saved = await customerCartFixtureAdapter({
      url: `/cart/items/${cartItemId}/save-for-later`,
      method: 'post',
    });
    expect(saved.data.data.items).toHaveLength(0);
    expect(saved.data.data.savedItems).toHaveLength(1);

    const restored = await customerCartFixtureAdapter({
      url: `/cart/saved/${cartItemId}/move-to-cart`,
      method: 'post',
    });
    expect(restored.data.data.items).toHaveLength(1);
  });

  it('enforces coupon eligibility on the server', async () => {
    await expect(
      customerCartFixtureAdapter({
        url: '/cart/coupon',
        method: 'post',
        data: { code: 'FLAT50' },
      }),
    ).rejects.toMatchObject({
      response: { status: 409, data: { error: { code: 'COUPON_MINIMUM_NOT_MET' } } },
    });

    const applied = await customerCartFixtureAdapter({
      url: '/cart/coupon',
      method: 'post',
      data: { code: 'SAVE20' },
    });
    expect(applied.data.data.appliedCoupon.code).toBe('SAVE20');
    expect(applied.data.data.totals.couponDiscountPaise).toBe(2000);
  });

  it('rejects quantity above the seller limit', async () => {
    const cart = await customerCartFixtureAdapter({ url: '/cart', method: 'get' });
    const cartItemId = cart.data.data.items[0].cartItemId;
    await expect(
      customerCartFixtureAdapter({
        url: `/cart/items/${cartItemId}`,
        method: 'patch',
        data: { quantity: 11 },
      }),
    ).rejects.toMatchObject({
      response: { status: 409, data: { error: { code: 'QUANTITY_UNAVAILABLE' } } },
    });
  });
});
