import assert from 'node:assert/strict';
import test from 'node:test';
import { getServiceability, validateAddress } from '../src/modules/customer/application/address.service.js';

const address = {
  label: 'Home', isDefault: false, name: 'Asha Rao', phone: '+91 98765 43210',
  line: '221B Baker Street', city: 'Ahmedabad', state: 'Gujarat', pincode: '380015',
};

test('address serviceability accepts launch areas and blocks unsupported saves', () => {
  assert.deepEqual(getServiceability('380015'), {
    pincode: '380015', serviceable: true, city: 'Ahmedabad', state: 'Gujarat',
    estimatedDeliveryDays: 3, message: 'Delivery is available in 3 days.',
  });
  assert.equal(getServiceability('110001').serviceable, false);
  assert.deepEqual(validateAddress(address), { valid: true, normalizedAddress: address });
  assert.throws(() => validateAddress({ ...address, pincode: '110001' }), { code: 'ADDRESS_UNSERVICEABLE' });
});
