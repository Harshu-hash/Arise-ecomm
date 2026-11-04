import {
  addressResponseSchema,
  addressesResponseSchema,
  addressValidationResponseSchema,
  serviceabilityResponseSchema,
} from './address.schemas';

const iconByLabel = { Home: 'home', Work: 'briefcase', Other: 'map-pin' };
export const mapAddress = address => ({
  ...address,
  cityLine: `${address.city}, ${address.state} - ${address.pincode}`,
  address: `${address.line}, ${address.city}, ${address.state} - ${address.pincode}`,
  icon: iconByLabel[address.label],
});
export const mapAddresses = payload => {
  const data = addressesResponseSchema.parse(payload).data;
  return { ...data, items: data.items.map(mapAddress) };
};
export const mapAddressResponse = payload => mapAddress(addressResponseSchema.parse(payload).data);
export const mapAddressValidation = payload => addressValidationResponseSchema.parse(payload).data;
export const mapServiceability = payload => serviceabilityResponseSchema.parse(payload).data;
