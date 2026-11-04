export const ADDRESS_ENDPOINTS = {
  root: '/addresses',
  item: addressId => `/addresses/${encodeURIComponent(addressId)}`,
  makeDefault: addressId => `/addresses/${encodeURIComponent(addressId)}/default`,
  validate: '/addresses/validate',
  serviceability: '/serviceability',
};
