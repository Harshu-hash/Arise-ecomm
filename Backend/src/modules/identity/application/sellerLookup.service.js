import { Seller } from '../infrastructure/persistence/seller.model.js';
import { User } from '../infrastructure/persistence/user.model.js';

const id = (value) => (value ? String(value) : null);

/** Store name/status for a batch of seller IDs — for other modules to label rows they own, never to join on. */
export async function getSellerSummaries(sellerIds) {
  const uniqueIds = [...new Set((sellerIds ?? []).map(String))];
  if (!uniqueIds.length) return new Map();
  const rows = await Seller.find({ _id: { $in: uniqueIds } }, 'storeName status').lean();
  return new Map(rows.map((row) => [id(row._id), { id: id(row._id), name: row.storeName, status: row.status }]));
}

/** The seller account owner's email, for other modules to notify them — never to join on. */
export async function getSellerOwnerEmail(sellerId) {
  const owner = await User.findOne({ sellerId, role: 'SELLER' }, 'email').lean();
  return owner?.email ?? null;
}

/** Name/email for a batch of user IDs — for labelling "who did this" (audit log), never to join on. */
export async function getUserSummaries(userIds) {
  const uniqueIds = [...new Set((userIds ?? []).filter(Boolean).map(String))];
  if (!uniqueIds.length) return new Map();
  const rows = await User.find({ _id: { $in: uniqueIds } }, 'name email').lean();
  return new Map(rows.map((row) => [id(row._id), { name: row.name, email: row.email }]));
}
