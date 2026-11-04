import {
  customerAddressFixtureAdapter,
  resetCustomerAddressFixture,
} from './customerAddressAdapter';

describe('customerAddressFixtureAdapter', () => {
  beforeEach(resetCustomerAddressFixture);

  it('creates, edits and deletes an address through production contracts', async () => {
    const created = await customerAddressFixtureAdapter({
      url: '/addresses',
      method: 'post',
      data: {
        label: 'Other',
        isDefault: false,
        name: 'Test Customer',
        phone: '+91 99999 99999',
        line: '84 Test Street',
        city: 'Ratlam',
        state: 'Madhya Pradesh',
        pincode: '457001',
      },
    });
    const addressId = created.data.data.id;
    const updated = await customerAddressFixtureAdapter({
      url: `/addresses/${addressId}`,
      method: 'patch',
      data: { label: 'Home' },
    });
    expect(updated.data.data.label).toBe('Home');

    await customerAddressFixtureAdapter({ url: `/addresses/${addressId}`, method: 'delete' });
    const list = await customerAddressFixtureAdapter({ url: '/addresses', method: 'get' });
    expect(list.data.data.items.some(item => item.id === addressId)).toBe(false);
  });

  it('sets the default address atomically', async () => {
    await customerAddressFixtureAdapter({
      url: '/addresses/addr-2/default',
      method: 'post',
    });
    const list = await customerAddressFixtureAdapter({ url: '/addresses', method: 'get' });

    expect(list.data.data.items.filter(item => item.isDefault)).toHaveLength(1);
    expect(list.data.data.defaultAddressId).toBe('addr-2');
  });

  it('reports serviceable and unsupported pincodes', async () => {
    const supported = await customerAddressFixtureAdapter({
      url: '/serviceability',
      method: 'get',
      params: { pincode: '380015' },
    });
    const unsupported = await customerAddressFixtureAdapter({
      url: '/serviceability',
      method: 'get',
      params: { pincode: '110001' },
    });

    expect(supported.data.data.serviceable).toBe(true);
    expect(unsupported.data.data.serviceable).toBe(false);
  });

  it('returns field-level validation errors', async () => {
    await expect(
      customerAddressFixtureAdapter({
        url: '/addresses/validate',
        method: 'post',
        data: { label: 'Home', name: '', phone: '1', line: '', city: '', state: '', pincode: '0' },
      }),
    ).rejects.toMatchObject({
      response: {
        status: 422,
        data: { error: { code: 'ADDRESS_VALIDATION_FAILED', fieldErrors: expect.any(Object) } },
      },
    });
  });
});
