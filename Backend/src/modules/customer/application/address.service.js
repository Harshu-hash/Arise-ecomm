import mongoose from 'mongoose';
import { AppError, ConflictError } from '../../../shared/errors/AppError.js';
import { AddressBook } from '../infrastructure/persistence/addressBook.model.js';

const MAX_ADDRESSES = 20;
const MAX_WRITE_ATTEMPTS = 3;

// shortcut: static launch-area catalog, replace with the logistics provider when delivery coverage becomes dynamic.
const SERVICEABLE_PINCODES = Object.freeze({
  380015: { city: 'Ahmedabad', state: 'Gujarat', estimatedDeliveryDays: 3 },
  380054: { city: 'Ahmedabad', state: 'Gujarat', estimatedDeliveryDays: 4 },
  457001: { city: 'Ratlam', state: 'Madhya Pradesh', estimatedDeliveryDays: 5 },
});

const addressNotFound = () =>
  new AppError({ code: 'ADDRESS_NOT_FOUND', status: 404, message: 'This address no longer exists.' });
const unserviceable = () =>
  new ConflictError('ADDRESS_UNSERVICEABLE', 'Delivery is not available at this address.');

const serialize = (address) => ({
  id: String(address._id),
  label: address.label,
  isDefault: address.isDefault,
  name: address.name,
  phone: address.phone,
  line: address.line,
  city: address.city,
  state: address.state,
  pincode: address.pincode,
});

export function getServiceability(pincode) {
  const location = SERVICEABLE_PINCODES[pincode];
  return location
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
      };
}

export function validateAddress(address) {
  if (!getServiceability(address.pincode).serviceable) throw unserviceable();
  return { valid: true, normalizedAddress: address };
}

async function changeBook(customerId, change) {
  for (let attempt = 0; attempt < MAX_WRITE_ATTEMPTS; attempt += 1) {
    const book = (await AddressBook.findOne({ customerId })) ?? new AddressBook({ customerId });
    const result = change(book);
    try {
      await book.save();
      return result;
    } catch (error) {
      if (!(error instanceof mongoose.Error.VersionError) && error?.code !== 11000) throw error;
    }
  }
  throw new ConflictError('ADDRESS_CHANGED', 'Your addresses changed on another device. Please try again.');
}

export async function listAddresses(customerId) {
  const book = await AddressBook.findOne({ customerId }).lean();
  const items = (book?.addresses ?? []).map(serialize);
  return { items, defaultAddressId: items.find((address) => address.isDefault)?.id ?? null };
}

export async function createAddress(customerId, input) {
  validateAddress(input);
  const address = await changeBook(customerId, (book) => {
    if (book.addresses.length >= MAX_ADDRESSES) {
      throw new ConflictError('ADDRESS_LIMIT_REACHED', `You can save up to ${MAX_ADDRESSES} addresses.`);
    }
    const isDefault = input.isDefault || book.addresses.length === 0;
    if (isDefault) book.addresses.forEach((item) => { item.isDefault = false; });
    book.addresses.push({ ...input, isDefault });
    return book.addresses.at(-1);
  });
  return serialize(address);
}

export async function updateAddress(customerId, addressId, patch) {
  return serialize(await changeBook(customerId, (book) => {
    const address = book.addresses.id(addressId);
    if (!address) throw addressNotFound();
    const wasDefault = address.isDefault;
    Object.assign(address, patch);
    validateAddress({ ...address.toObject(), ...patch });
    if (patch.isDefault) book.addresses.forEach((item) => { item.isDefault = item.id === address.id; });
    else if (wasDefault) address.isDefault = true;
    return address;
  }));
}

export async function makeDefaultAddress(customerId, addressId) {
  return serialize(await changeBook(customerId, (book) => {
    const selected = book.addresses.id(addressId);
    if (!selected) throw addressNotFound();
    if (!getServiceability(selected.pincode).serviceable) throw unserviceable();
    book.addresses.forEach((address) => { address.isDefault = address.id === selected.id; });
    return selected;
  }));
}

export async function deleteAddress(customerId, addressId) {
  await changeBook(customerId, (book) => {
    const index = book.addresses.findIndex((address) => address.id === addressId);
    if (index < 0) throw addressNotFound();
    const wasDefault = book.addresses[index].isDefault;
    book.addresses.splice(index, 1);
    if (wasDefault && book.addresses.length) book.addresses[0].isDefault = true;
  });
  return { deleted: true, addressId };
}
