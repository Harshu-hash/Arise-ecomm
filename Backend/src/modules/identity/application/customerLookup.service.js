import { ROLES } from '../../../shared/constants/roles.js';
import { User } from '../infrastructure/persistence/user.model.js';

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const CUSTOMER = { role: ROLES.CUSTOMER, status: 'ACTIVE' };
const label = (user) => ({ id: String(user._id), name: user.name || user.email || user.phone, contact: user.phone || user.email || '' });

/** Active customers for admin pickers: by name/email/phone search or by explicit ids. Never exposes credentials. */
export async function findCustomers({ q, ids, limit }) {
  const search = q ? new RegExp(escapeRegex(q), 'i') : null;
  const filter = {
    ...CUSTOMER,
    ...(ids?.length ? { _id: { $in: ids } } : {}),
    ...(search ? { $or: [{ name: search }, { email: search }, { phone: search }] } : {}),
  };
  return (await User.find(filter, 'name email phone').sort({ name: 1 }).limit(limit).lean()).map(label);
}

/** How many of these ids are real, active customers (audience validation and reach estimates). */
export const countCustomers = (ids) => User.countDocuments({ ...CUSTOMER, ...(ids ? { _id: { $in: ids } } : {}) });

/** Active customer ids after `afterId`, oldest first, for walking everyone in batches (broadcasts). */
export async function listCustomerIds({ afterId = null, limit = 500 } = {}) {
  const rows = await User.find({ ...CUSTOMER, ...(afterId ? { _id: { $gt: afterId } } : {}) }, '_id').sort({ _id: 1 }).limit(limit).lean();
  return rows.map((row) => String(row._id));
}

/** A customer's name and email for sending them mail; never to join on. */
export async function getCustomerContact(id) {
  const user = await User.findOne({ ...CUSTOMER, _id: id }, 'name email').lean();
  return user ? { name: user.name ?? null, email: user.email ?? null } : null;
}

export async function getCustomer(id) {
  const user = await User.findOne({ ...CUSTOMER, _id: id }, 'name email phone').lean();
  return user ? label(user) : null;
}
