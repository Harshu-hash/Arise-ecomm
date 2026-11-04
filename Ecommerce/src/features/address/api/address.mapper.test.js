import { createAddressesFixtureEnvelope } from '@mocks/customerAddressAdapter';
import { mapAddresses, mapServiceability } from './address.mapper';

describe('address contract mappers', () => {
  it('creates display-ready address lines while preserving structured fields', () => {
    const result = mapAddresses(createAddressesFixtureEnvelope());

    expect(result.defaultAddressId).toBe('addr-1');
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        pincode: '380015',
        cityLine: 'Ahmedabad, Gujarat - 380015',
        icon: 'home',
      }),
    );
  });

  it('validates serviceability responses', () => {
    expect(
      mapServiceability({
        data: {
          pincode: '380015',
          serviceable: true,
          city: 'Ahmedabad',
          state: 'Gujarat',
          estimatedDeliveryDays: 3,
          message: 'Delivery is available.',
        },
      }),
    ).toMatchObject({ serviceable: true, estimatedDeliveryDays: 3 });
  });

  it('rejects malformed phone data', () => {
    const payload = createAddressesFixtureEnvelope();
    payload.data.items[0].phone = 'abc';

    expect(() => mapAddresses(payload)).toThrow();
  });
});
