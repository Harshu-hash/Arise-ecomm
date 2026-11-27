import mongoose from 'mongoose';
import { AppError, ConflictError } from '../../../shared/errors/AppError.js';
import { env } from '../../../config/env.js';
import { quoteShipping } from '../../shipping/public/index.js';
import { AddressBook } from '../infrastructure/persistence/addressBook.model.js';

const MAX_ADDRESSES = 20;
const MAX_WRITE_ATTEMPTS = 3;

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

/** Live courier coverage from Shiprocket (via quoteShipping, which stays open if Shiprocket is down so saving an address is never blocked by an outage). */
export async function getServiceability(pincode) {
  // an address is never refused because rates cannot be fetched (the flat-fee switch makes quoteShipping throw then); checkout still prices it
  const quote = await quoteShipping({ pickupPincode: env.SHIPROCKET_PICKUP_PINCODE, deliveryPincode: pincode, weightG: 500 })
    .catch(() => ({ serviceable: true, etaDays: null }));
  const days = quote.etaDays;
  return {
    pincode,
    serviceable: quote.serviceable,
    city: null,
    state: null,
    estimatedDeliveryDays: quote.serviceable ? days : null,
    message: !quote.serviceable
      ? 'Delivery is not available for this pincode yet.'
      : days ? `Delivery is available in ${days} days.` : 'Delivery is available.',
  };
}

export async function validateAddress(address) {
  if (!(await getServiceability(address.pincode)).serviceable) throw unserviceable();
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
  await validateAddress(input);
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
  if (patch.pincode) await validateAddress({ pincode: patch.pincode });
  return serialize(await changeBook(customerId, (book) => {
    const address = book.addresses.id(addressId);
    if (!address) throw addressNotFound();
    const wasDefault = address.isDefault;
    Object.assign(address, patch);
    if (patch.isDefault) book.addresses.forEach((item) => { item.isDefault = item.id === address.id; });
    else if (wasDefault) address.isDefault = true;
    return address;
  }));
}

export async function makeDefaultAddress(customerId, addressId) {
  const current = await getAddress(customerId, addressId);
  if (!current) throw addressNotFound();
  await validateAddress(current);
  return serialize(await changeBook(customerId, (book) => {
    const selected = book.addresses.id(addressId);
    if (!selected) throw addressNotFound();
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

/** One of the customer's saved addresses as { id, label, isDefault, name, phone, line, city, state, pincode }, or null. */
export async function getAddress(customerId, addressId) {
  const book = await AddressBook.findOne({ customerId }).lean();
  const address = book?.addresses.find((entry) => String(entry._id) === String(addressId));
  return address ? serialize(address) : null;
}

/** The customer's default address, or their only one, or null. */
export async function getDefaultAddress(customerId) {
  const book = await AddressBook.findOne({ customerId }).lean();
  const address = book?.addresses.find((entry) => entry.isDefault) ?? (book?.addresses.length === 1 ? book.addresses[0] : null);
  return address ? serialize(address) : null;
}
