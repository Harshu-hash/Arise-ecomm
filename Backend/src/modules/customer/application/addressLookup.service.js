import mongoose from 'mongoose';
import { AddressBook } from '../infrastructure/persistence/addressBook.model.js';

const squash = (text) => String(text).toLowerCase().replace(/[^a-z0-9]/g, '');

/** A normalised "street + pincode" key for each saved address of each customer, to spot two accounts delivering to the same door. */
export async function getAddressKeys(userIds) {
  const books = await AddressBook.find({ customerId: { $in: userIds.filter((id) => mongoose.isValidObjectId(id)) } }).lean();
  const byUser = new Map(userIds.map((id) => [String(id), new Set()]));
  for (const book of books) for (const a of book.addresses) byUser.get(String(book.customerId))?.add(`${squash(a.line)}|${a.pincode}`);
  return byUser;
}
