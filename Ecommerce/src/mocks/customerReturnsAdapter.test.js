import { resetCustomerAddressFixture } from './customerAddressAdapter';
import { resetCustomerOrdersFixture } from './customerOrdersAdapter';
import {
  customerReturnsFixtureAdapter,
  resetCustomerReturnsFixture,
} from './customerReturnsAdapter';

describe('customerReturnsFixtureAdapter', () => {
  beforeEach(() => {
    resetCustomerAddressFixture();
    resetCustomerOrdersFixture();
    resetCustomerReturnsFixture();
  });

  it('returns backend eligibility for delivered order items', async () => {
    const result = await customerReturnsFixtureAdapter({
      url: '/orders/ORD-77213/returnable-items',
      method: 'get',
    });
    expect(result.data.data.items[0]).toMatchObject({ eligible: true });
    expect(result.data.data.reasons.length).toBeGreaterThan(0);
  });

  it('creates and retrieves a refund return request', async () => {
    const eligibility = await customerReturnsFixtureAdapter({
      url: '/orders/ORD-77213/returnable-items',
      method: 'get',
    });
    const orderItemId = eligibility.data.data.items[0].orderItemId;
    const created = await customerReturnsFixtureAdapter({
      url: '/returns',
      method: 'post',
      data: {
        orderId: 'ORD-77213',
        orderItemId,
        resolution: 'REFUND',
        reasonCode: 'SIZE_FIT',
        pickupAddressId: 'addr-1',
        evidenceMediaIds: [],
        refundDestination: 'ORIGINAL_PAYMENT',
      },
    });
    const detail = await customerReturnsFixtureAdapter({
      url: `/returns/${created.data.data.id}`,
      method: 'get',
    });
    expect(detail.data.data).toMatchObject({ status: 'PICKUP_SCHEDULED', resolution: 'REFUND' });
  });

  it('requires evidence for damage reasons', async () => {
    const eligibility = await customerReturnsFixtureAdapter({
      url: '/orders/ORD-77213/returnable-items',
      method: 'get',
    });
    await expect(
      customerReturnsFixtureAdapter({
        url: '/returns',
        method: 'post',
        data: {
          orderId: 'ORD-77213',
          orderItemId: eligibility.data.data.items[0].orderItemId,
          resolution: 'REFUND',
          reasonCode: 'DAMAGED',
          pickupAddressId: 'addr-1',
          evidenceMediaIds: [],
        },
      }),
    ).rejects.toMatchObject({
      response: { status: 422, data: { error: { code: 'EVIDENCE_REQUIRED' } } },
    });
  });

  it('prevents duplicate active returns for one order item', async () => {
    const eligibility = await customerReturnsFixtureAdapter({
      url: '/orders/ORD-77213/returnable-items',
      method: 'get',
    });
    const data = {
      orderId: 'ORD-77213',
      orderItemId: eligibility.data.data.items[0].orderItemId,
      resolution: 'REPLACEMENT',
      reasonCode: 'SIZE_FIT',
      pickupAddressId: 'addr-1',
      evidenceMediaIds: [],
    };
    await customerReturnsFixtureAdapter({ url: '/returns', method: 'post', data });
    await expect(
      customerReturnsFixtureAdapter({ url: '/returns', method: 'post', data }),
    ).rejects.toMatchObject({
      response: { status: 409, data: { error: { code: 'ITEM_NOT_RETURNABLE' } } },
    });
  });
});
