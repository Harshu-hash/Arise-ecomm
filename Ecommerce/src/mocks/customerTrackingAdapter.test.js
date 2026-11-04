import { resetCustomerAddressFixture } from './customerAddressAdapter';
import { resetCustomerOrdersFixture } from './customerOrdersAdapter';
import { customerTrackingFixtureAdapter } from './customerTrackingAdapter';

describe('customerTrackingFixtureAdapter', () => {
  beforeEach(() => {
    resetCustomerAddressFixture();
    resetCustomerOrdersFixture();
  });

  it('serves courier tracking by stable order/shipment ID', async () => {
    const response = await customerTrackingFixtureAdapter({
      url: '/shipments/ORD-84920/tracking',
      method: 'get',
    });
    expect(response.data.data).toMatchObject({
      shipmentId: 'ORD-84920',
      status: 'PROCESSING',
      deliveryAgent: null,
    });
  });

  it('redacts the delivery code outside out-for-delivery state', async () => {
    const response = await customerTrackingFixtureAdapter({
      url: '/shipments/ORD-77213/tracking',
      method: 'get',
    });
    expect(response.data.data.deliveryCode).toMatchObject({ revealAllowed: false, value: null });
  });

  it('returns a recoverable error for an invalid tracking deep link', async () => {
    await expect(
      customerTrackingFixtureAdapter({
        url: '/shipments/ORD-MISSING/tracking',
        method: 'get',
      }),
    ).rejects.toMatchObject({
      response: { status: 404, data: { error: { code: 'SHIPMENT_NOT_FOUND' } } },
    });
  });
});
