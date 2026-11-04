import { AxiosError } from 'axios';

const LATENCY_MS = 250;
const serviceablePincodes = {
  380015: { city: 'Ahmedabad', state: 'Gujarat', estimatedDeliveryDays: 3 },
  380054: { city: 'Ahmedabad', state: 'Gujarat', estimatedDeliveryDays: 4 },
  457001: { city: 'Ratlam', state: 'Madhya Pradesh', estimatedDeliveryDays: 5 },
};
let nextAddressId = 3;
let addresses = [];

const wait = () => new Promise(resolve => setTimeout(resolve, LATENCY_MS));
const response = (config, data, status = 200) => ({
  data,
  status,
  statusText: status < 400 ? 'OK' : 'Error',
  headers: { 'content-type': 'application/json' },
  config,
  request: null,
});
const reject = (config, status, code, message, fieldErrors = null) => {
  throw new AxiosError(
    message,
    code,
    config,
    null,
    response(config, { error: { code, message, fieldErrors } }, status),
  );
};
const listEnvelope = () => ({
  data: {
    items: addresses,
    defaultAddressId: addresses.find(address => address.isDefault)?.id ?? null,
  },
});
const normalizedInput = input => ({
  label: input.label,
  isDefault: Boolean(input.isDefault),
  name: String(input.name || '').trim(),
  phone: String(input.phone || '')
    .replace(/[^0-9+ ]/g, '')
    .trim(),
  line: String(input.line || '').trim(),
  city: String(input.city || '').trim(),
  state: String(input.state || '').trim(),
  pincode: String(input.pincode || '').trim(),
});
const validateInput = (config, input) => {
  const value = normalizedInput(input);
  const fieldErrors = {};
  if (value.name.length < 2) fieldErrors.name = 'Enter the recipient name.';
  if (!/^\+?[0-9 ]{10,16}$/.test(value.phone)) fieldErrors.phone = 'Enter a valid mobile number.';
  if (!/^[1-9][0-9]{5}$/.test(value.pincode))
    fieldErrors.pincode = 'Enter a valid 6-digit pincode.';
  if (value.line.length < 5) fieldErrors.line = 'Enter the complete street address.';
  if (value.city.length < 2) fieldErrors.city = 'Enter the city.';
  if (value.state.length < 2) fieldErrors.state = 'Enter the state.';
  if (!['Home', 'Work', 'Other'].includes(value.label))
    fieldErrors.label = 'Choose an address type.';
  if (Object.keys(fieldErrors).length) {
    return reject(
      config,
      422,
      'ADDRESS_VALIDATION_FAILED',
      'Check the highlighted fields.',
      fieldErrors,
    );
  }
  return value;
};

export const resetCustomerAddressFixture = () => {
  nextAddressId = 3;
  addresses = [
    {
      id: 'addr-1',
      label: 'Home',
      isDefault: true,
      name: 'Harshvardhan Panchal',
      phone: '+91 98765 43210',
      line: '221B Baker Street, Sector 12, Near City Mall',
      city: 'Ahmedabad',
      state: 'Gujarat',
      pincode: '380015',
    },
    {
      id: 'addr-2',
      label: 'Work',
      isDefault: false,
      name: 'Harshvardhan Panchal',
      phone: '+91 98765 43210',
      line: '4th Floor, Tech Park One, SG Highway',
      city: 'Ahmedabad',
      state: 'Gujarat',
      pincode: '380054',
    },
  ];
};
resetCustomerAddressFixture();

export const customerAddressFixtureAdapter = async config => {
  await wait();
  if (config.url === '/addresses' && config.method === 'get') {
    return response(config, listEnvelope());
  }
  if (config.url === '/serviceability' && config.method === 'get') {
    const pincode = String(config.params?.pincode || '');
    if (!/^[1-9][0-9]{5}$/.test(pincode)) {
      return reject(config, 422, 'PINCODE_INVALID', 'Enter a valid 6-digit pincode.');
    }
    const location = serviceablePincodes[pincode];
    return response(config, {
      data: location
        ? {
            pincode,
            serviceable: true,
            ...location,
            message: `Delivery is available in ${location.estimatedDeliveryDays} days.`,
          }
        : {
            pincode,
            serviceable: false,
            city: null,
            state: null,
            estimatedDeliveryDays: null,
            message: 'Delivery is not available for this pincode yet.',
          },
    });
  }
  if (config.url === '/addresses/validate' && config.method === 'post') {
    const value = validateInput(config, config.data);
    if (!serviceablePincodes[value.pincode]) {
      return reject(
        config,
        409,
        'ADDRESS_UNSERVICEABLE',
        'Delivery is not available at this address.',
      );
    }
    return response(config, { data: { valid: true, normalizedAddress: value } });
  }
  if (config.url === '/addresses' && config.method === 'post') {
    const value = validateInput(config, config.data);
    if (!serviceablePincodes[value.pincode]) {
      return reject(
        config,
        409,
        'ADDRESS_UNSERVICEABLE',
        'Delivery is not available at this address.',
      );
    }
    const isFirst = addresses.length === 0;
    const created = {
      ...value,
      id: `addr-${nextAddressId++}`,
      isDefault: isFirst || value.isDefault,
    };
    if (created.isDefault) addresses = addresses.map(address => ({ ...address, isDefault: false }));
    addresses.push(created);
    return response(config, { data: created }, 201);
  }
  const defaultMatch = config.url?.match(/^\/addresses\/([^/]+)\/default$/);
  if (defaultMatch && config.method === 'post') {
    const addressId = decodeURIComponent(defaultMatch[1]);
    const selected = addresses.find(address => address.id === addressId);
    if (!selected)
      return reject(config, 404, 'ADDRESS_NOT_FOUND', 'This address no longer exists.');
    addresses = addresses.map(address => ({ ...address, isDefault: address.id === addressId }));
    return response(config, { data: addresses.find(address => address.id === addressId) });
  }
  const itemMatch = config.url?.match(/^\/addresses\/([^/]+)$/);
  if (itemMatch && config.method === 'patch') {
    const addressId = decodeURIComponent(itemMatch[1]);
    const index = addresses.findIndex(address => address.id === addressId);
    if (index < 0)
      return reject(config, 404, 'ADDRESS_NOT_FOUND', 'This address no longer exists.');
    const value = validateInput(config, { ...addresses[index], ...config.data });
    if (!serviceablePincodes[value.pincode]) {
      return reject(
        config,
        409,
        'ADDRESS_UNSERVICEABLE',
        'Delivery is not available at this address.',
      );
    }
    const updated = { ...value, id: addressId };
    if (updated.isDefault) addresses = addresses.map(address => ({ ...address, isDefault: false }));
    addresses[index] = updated;
    return response(config, { data: updated });
  }
  if (itemMatch && config.method === 'delete') {
    const addressId = decodeURIComponent(itemMatch[1]);
    const existing = addresses.find(address => address.id === addressId);
    if (!existing)
      return reject(config, 404, 'ADDRESS_NOT_FOUND', 'This address no longer exists.');
    addresses = addresses.filter(address => address.id !== addressId);
    if (existing.isDefault && addresses.length) addresses[0] = { ...addresses[0], isDefault: true };
    return response(config, { data: { deleted: true, addressId } });
  }
  return reject(
    config,
    501,
    'FIXTURE_NOT_IMPLEMENTED',
    `No fixture exists for ${config.method?.toUpperCase()} ${config.url}.`,
  );
};

export const createAddressesFixtureEnvelope = listEnvelope;
export const getAddressFixture = addressId =>
  addresses.find(address => address.id === addressId) ?? null;
