import { resetCustomerAddressFixture } from '@mocks/customerAddressAdapter';
import {
  createOrdersFixtureEnvelope,
  resetCustomerOrdersFixture,
} from '@mocks/customerOrdersAdapter';
import { mapOrders } from './orders.mapper';

describe('orders contract mapper', () => {
  beforeEach(() => {
    resetCustomerAddressFixture();
    resetCustomerOrdersFixture();
  });

  it('maps backend status, timeline, items and paise totals', () => {
    const result = mapOrders(createOrdersFixtureEnvelope());
    const order = result.items[0];

    expect(order).toEqual(
      expect.objectContaining({
        id: expect.stringMatching(/^ORD-/),
        statusCode: expect.any(String),
        status: expect.any(String),
        price: expect.any(Number),
        timeline: expect.any(Array),
      }),
    );
    expect(order.items[0]).toEqual(
      expect.objectContaining({ price: expect.any(Number), productId: expect.any(String) }),
    );
  });

  it('rejects unknown lifecycle statuses', () => {
    const payload = createOrdersFixtureEnvelope();
    payload.data.items[0].status = 'SOMETHING_NEW';
    expect(() => mapOrders(payload)).toThrow();
  });
});
