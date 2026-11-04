import { createCartFixtureEnvelope, resetCustomerCartFixture } from '@mocks/customerCartAdapter';
import { mapCart } from './cart.mapper';

describe('cart contract mapper', () => {
  beforeEach(resetCustomerCartFixture);

  it('maps server-owned line identity, quantity limits and totals', () => {
    const cart = mapCart(createCartFixtureEnvelope());

    expect(cart.items[0]).toEqual(
      expect.objectContaining({
        id: expect.stringMatching(/^cart-/),
        productId: 'h2',
        minQty: 1,
        maxQty: 10,
      }),
    );
    expect(cart.totals).toEqual(
      expect.objectContaining({ subtotal: 298, payable: 307, productDiscount: 497 }),
    );
  });

  it('rejects malformed authoritative totals', () => {
    const payload = createCartFixtureEnvelope();
    payload.data.totals.payablePaise = 1.5;

    expect(() => mapCart(payload)).toThrow();
  });
});
