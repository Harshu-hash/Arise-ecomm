import assert from 'node:assert/strict';
import test from 'node:test';
process.env.SHIPROCKET_PICKUP_PINCODE = '380015'; // read at import time
const { shippingGateway } = await import('../src/infrastructure/external/shipping/index.js');
const { getServiceability, validateAddress } = await import('../src/modules/customer/application/address.service.js');

const address = {
  label: 'Home', isDefault: false, name: 'Asha Rao', phone: '+91 98765 43210',
  line: '221B Baker Street', city: 'Jaipur', state: 'Rajasthan', pincode: '302001',
};

test('address serviceability follows the live Shiprocket answer', async (t) => {
  const quote = t.mock.method(shippingGateway, 'quote', async ({ deliveryPincode }) =>
    deliveryPincode === '302001' ? { serviceable: true, feePaise: 5000, etaDays: 4 } : { serviceable: false, feePaise: null, etaDays: null });
  assert.equal((await getServiceability('302001')).message, 'Delivery is available in 4 days.');
  assert.deepEqual(await validateAddress(address), { valid: true, normalizedAddress: address });
  assert.equal((await getServiceability('999999')).serviceable, false);
  await assert.rejects(validateAddress({ ...address, pincode: '999999' }), { code: 'ADDRESS_UNSERVICEABLE' });
  assert.equal(quote.mock.callCount(), 4);
});
