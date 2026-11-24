import { onCatalogChange } from '../../../infrastructure/realtime/catalogEvents.js';
import { decryptField } from '../../../shared/utils/crypto.js';
import { ttlMemo } from '../../../shared/utils/ttlMemo.js';
import { Seller } from '../infrastructure/persistence/seller.model.js';
import { User } from '../infrastructure/persistence/user.model.js';

const id = (value) => (value ? String(value) : null);

// Who may sell: an approved/active seller who is not on holiday. One rule in two shapes (a test for one seller, and the
// Mongo filter for everyone who may not), kept side by side so they cannot drift apart.
const SELLABLE_STATUSES = ['APPROVED', 'ACTIVE'];
const isSellable = (seller) => SELLABLE_STATUSES.includes(seller.status) && !seller.vacationMode;
const UNSELLABLE_FILTER = { $or: [{ status: { $nin: SELLABLE_STATUSES } }, { vacationMode: true }] };

/** Store name/status and whether it may sell right now, for a batch of seller IDs. Always current: use this when buying. */
export async function getSellerSummaries(sellerIds) {
  const uniqueIds = [...new Set((sellerIds ?? []).map(String))];
  if (!uniqueIds.length) return new Map();
  const rows = await Seller.find({ _id: { $in: uniqueIds } }, 'storeName status vacationMode location.pincode').lean();
  return new Map(rows.map((row) => [id(row._id), { id: id(row._id), name: row.storeName, status: row.status, pincode: row.location?.pincode ?? null, sellable: isSellable(row) }]));
}

// A "not these" list because it stays short next to the sellers who can. Cached briefly for catalog reads and cleared when
// the catalog changes (admin writes, a seller's vacation switch).
const unsellableSellerIds = ttlMemo(async () => (await Seller.find(UNSELLABLE_FILTER, '_id').lean()).map((row) => id(row._id)), 15_000, () => 'all');
onCatalogChange(unsellableSellerIds.clear);

/** Ids of every seller who is approved/active (on holiday or not), for notices that go to all sellers. */
export async function listActiveSellerIds() {
  return (await Seller.find({ status: { $in: SELLABLE_STATUSES } }, '_id').lean()).map((row) => id(row._id));
}

/** Ids of sellers whose listings must not be shown or sold right now. May lag a change by a few seconds. */
export const getUnsellableSellerIds = () => unsellableSellerIds();

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

/**
 * Where and who a courier collects a seller's parcels from: the seller's one address plus their owner's contact.
 * `pickupLocationName` is the name that address has on Shiprocket, once it was created there.
 */
export async function getSellerPickupProfile(sellerId) {
  const [seller, owner] = await Promise.all([
    Seller.findById(sellerId, 'storeName ownerName location pickupLocationName').lean(),
    User.findOne({ sellerId, role: 'SELLER' }, 'name email phone').lean(),
  ]);
  if (!seller) return null;
  return {
    storeName: seller.storeName,
    contactName: owner?.name || seller.ownerName || seller.storeName,
    email: owner?.email ?? null,
    phone: owner?.phone ?? null,
    location: seller.location ?? {},
    pickupLocationName: seller.pickupLocationName ?? null,
  };
}

/** What paying a batch of sellers needs: name, approval date, bank holder/ifsc, whether the bank account is verified and its last 4 digits, PAN on file, and any admin payout hold. */
export async function getSellerPayoutProfiles(sellerIds) {
  const uniqueIds = [...new Set((sellerIds ?? []).map(String))];
  const rows = uniqueIds.length ? await Seller.find({ _id: { $in: uniqueIds } }, 'storeName bankOk bank pan payoutHold approvedAt').lean() : [];
  const last4 = (stored) => {
    if (!stored) return null;
    try {
      return decryptField(stored).slice(-4);
    } catch {
      return String(stored).slice(-4); // stored before encryption was introduced
    }
  };
  return new Map(rows.map((row) => [id(row._id), { name: row.storeName, bankOk: Boolean(row.bankOk), bankLast4: last4(row.bank?.accountNumber), bank: { holder: row.bank?.accountHolder ?? null, ifsc: row.bank?.ifsc ?? null, bankName: row.bank?.bankName ?? null }, approvedAt: row.approvedAt ?? null, hasPan: Boolean(row.pan), onHold: Boolean(row.payoutHold?.on), holdReason: row.payoutHold?.reason ?? null }]));
}

/** Admin switch: while on, none of the seller's settlements is paid out. Returns false when the seller does not exist. */
export async function setSellerPayoutHold(sellerId, on, reason) {
  const result = await Seller.updateOne({ _id: sellerId }, { $set: { payoutHold: { on, reason: on ? reason : null } } });
  return result.matchedCount > 0;
}

/** Who the seller is on a tax invoice: legal name, GSTIN (decrypted) and registered address. */
export async function getSellerTaxProfile(sellerId) {
  const seller = await Seller.findById(sellerId, 'storeName legalName gstin location').lean();
  if (!seller) return null;
  let gstin = null;
  try {
    gstin = seller.gstin ? decryptField(seller.gstin) : null;
  } catch {
    gstin = seller.gstin; // stored before encryption was introduced
  }
  const { address, locality, city, state, pincode } = seller.location ?? {};
  return { name: seller.legalName || seller.storeName, gstin, state: state ?? null, address: [address, locality, city, pincode].filter(Boolean).join(', ') };
}

export const setSellerPickupLocationName = (sellerId, name) => Seller.updateOne({ _id: sellerId }, { $set: { pickupLocationName: name } });
