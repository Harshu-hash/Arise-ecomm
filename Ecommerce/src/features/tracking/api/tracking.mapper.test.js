import { resetCustomerAddressFixture } from '@mocks/customerAddressAdapter';
import { resetCustomerOrdersFixture } from '@mocks/customerOrdersAdapter';
import { createTrackingFixtureEnvelope } from '@mocks/customerTrackingAdapter';
import { mapTracking } from './tracking.mapper';

describe('tracking contract mapper', () => {
  beforeEach(() => {
    resetCustomerAddressFixture();
    resetCustomerOrdersFixture();
  });

  it('validates courier events and polling policy', () => {
    const tracking = mapTracking(createTrackingFixtureEnvelope('ORD-84920'));
    expect(tracking).toMatchObject({
      orderId: 'ORD-84920',
      status: 'PROCESSING',
      pollingIntervalSeconds: 30,
      courier: { name: 'Arise Logistics' },
    });
    expect(tracking.events.some(event => event.active)).toBe(true);
  });

  it('does not invent a live agent location when the courier supplies none', () => {
    const tracking = mapTracking(createTrackingFixtureEnvelope('ORD-84920'));
    expect(tracking.deliveryAgent).toBeNull();
  });

  it('rejects invalid coordinates from a courier payload', () => {
    const payload = createTrackingFixtureEnvelope('ORD-84920');
    payload.data.deliveryAgent = {
      displayName: 'Courier',
      vehicleLabel: null,
      maskedPhone: null,
      contactAllowed: false,
      location: { latitude: 120, longitude: 20, updatedAt: new Date().toISOString() },
    };
    expect(() => mapTracking(payload)).toThrow();
  });
});
