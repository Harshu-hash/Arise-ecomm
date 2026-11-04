import {
  customerWishlistFixtureAdapter,
  resetCustomerWishlistFixture,
} from './customerWishlistAdapter';

describe('customerWishlistFixtureAdapter', () => {
  beforeEach(resetCustomerWishlistFixture);

  it('adds and removes products through the production contract', async () => {
    await customerWishlistFixtureAdapter({
      url: '/wishlist/items',
      method: 'post',
      data: { productId: 'e3' },
    });
    let list = await customerWishlistFixtureAdapter({ url: '/wishlist', method: 'get' });
    expect(list.data.data.items.some(item => item.id === 'e3')).toBe(true);

    await customerWishlistFixtureAdapter({ url: '/wishlist/items/e3', method: 'delete' });
    list = await customerWishlistFixtureAdapter({ url: '/wishlist', method: 'get' });
    expect(list.data.data.items.some(item => item.id === 'e3')).toBe(false);
  });

  it('moves an available wishlist item to cart', async () => {
    const moved = await customerWishlistFixtureAdapter({
      url: '/wishlist/e1/move-to-cart',
      method: 'post',
    });

    expect(moved.data.data).toMatchObject({ productId: 'e1', wishlisted: false });
  });

  it('returns a conflict when an unavailable item is moved to cart', async () => {
    await expect(
      customerWishlistFixtureAdapter({
        url: '/wishlist/e6/move-to-cart',
        method: 'post',
      }),
    ).rejects.toMatchObject({
      response: { status: 409, data: { error: { code: 'PRODUCT_OUT_OF_STOCK' } } },
    });
  });
});
