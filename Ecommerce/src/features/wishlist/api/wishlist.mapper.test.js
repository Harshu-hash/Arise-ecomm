import { createWishlistFixtureEnvelope } from '@mocks/customerWishlistAdapter';
import { mapWishlist } from './wishlist.mapper';

describe('wishlist contract mapper', () => {
  it('maps product money and availability into the wishlist UI model', () => {
    const wishlist = mapWishlist(createWishlistFixtureEnvelope());

    expect(wishlist.total).toBe(wishlist.items.length);
    expect(wishlist.items[0]).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        price: expect.any(Number),
        inStock: expect.any(Boolean),
        addedAt: expect.stringMatching(/Z$/),
      }),
    );
  });

  it('rejects inconsistent backend totals', () => {
    const payload = createWishlistFixtureEnvelope();
    payload.data.items[0].pricePaise = -1;

    expect(() => mapWishlist(payload)).toThrow();
  });
});
