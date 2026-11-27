import { recordAudit } from '../../../infrastructure/audit/audit.js';
import { shippingGateway } from '../../../infrastructure/external/shipping/index.js';
import { catalogChanged } from '../../../infrastructure/realtime/catalogEvents.js';
import { publicUrl } from '../../../infrastructure/storage/local.storage.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../../../shared/errors/AppError.js';
import { decryptField, encryptField, verifyPassword } from '../../../shared/utils/crypto.js';
import { signStepUpToken } from '../../../shared/utils/jwt.js';
import { Seller } from '../infrastructure/persistence/seller.model.js';
import { User } from '../infrastructure/persistence/user.model.js';

const NO_BANK = { accountHolder: null, accountNumber: null, ifsc: null, bankName: null, branch: null };

// The full account number never leaves the server; only the last 4 digits are shown.
export function serializeBank(seller) {
  const { bank } = seller;
  if (!bank?.accountNumber) return null;
  return {
    accountHolder: bank.accountHolder,
    accountNumber: decryptField(bank.accountNumber).replace(/\d(?=\d{4})/g, '•'),
    ifsc: bank.ifsc,
    bankName: bank.bankName ?? '',
    branch: bank.branch ?? '',
    // No penny-drop provider yet: an admin flips bankOk, any change here resets it.
    pennyDropStatus: seller.bankOk ? 'VERIFIED' : 'PENDING',
  };
}

async function updateSeller(sellerId, set, projection) {
  const seller = await Seller.findByIdAndUpdate(sellerId, { $set: set }, { new: true, projection, runValidators: true }).lean();
  if (!seller) throw new NotFoundError('Seller account not found.');
  return seller;
}

export async function issueStepUpToken(userId, password) {
  const user = await User.findById(userId).select('passwordHash').lean();
  // 403, not 401: a 401 would make the client think the session expired and sign the seller out.
  if (!user?.passwordHash || !(await verifyPassword(password, user.passwordHash))) throw new ForbiddenError('Password is incorrect.');
  return { token: signStepUpToken(userId) };
}

export const logoUrlOf = (key) => (key ? publicUrl(key) : null);

// logoKey: undefined = leave as is, null = remove, string = a logo this seller uploaded.
export async function updateProfile(sellerId, { storeName, logoKey }, actor) {
  if (logoKey && !logoKey.startsWith(`public/logos/${sellerId}/`)) throw new ValidationError(undefined, { logoKey: ['Upload the logo first.'] });
  const set = { storeName, ...(logoKey !== undefined && { logoKey }) };
  const seller = await updateSeller(sellerId, set, 'storeName vacationMode logoKey');
  await recordAudit({ action: 'seller.profile.update', subjectType: 'seller', subjectId: sellerId, after: set, actor });
  return { id: String(seller._id), storeName: seller.storeName, vacationMode: seller.vacationMode, logoUrl: logoUrlOf(seller.logoKey) };
}

/** Sets (or clears) the seller's GSTIN. Without one the seller's documents are bills of supply with no GST; an admin still verifies it (gstinOk resets). */
export async function setGstin(sellerId, gstin, actor) {
  await updateSeller(sellerId, { gstin: gstin ? encryptField(gstin) : null, gstinOk: false }, 'gstin');
  await recordAudit({ action: 'seller.gstin.set', subjectType: 'seller', subjectId: sellerId, after: { gstin: gstin ? `${gstin.slice(0, 2)}••••••••${gstin.slice(-3)}` : null }, actor });
  return { gstin };
}

/** Whether Shiprocket has verified the pickup phone: true/false, or null when not registered yet or Shiprocket cannot be asked (never blocks the page). */
async function courierVerified(name) {
  if (!name) return null;
  try { return await shippingGateway.isPickupVerified(name); } catch { return null; }
}

/** The store's one pickup address (where couriers collect parcels), plus the contact the courier is given and whether it is registered. */
export async function getPickupAddress(sellerId) {
  const [seller, owner] = await Promise.all([
    Seller.findById(sellerId, 'location pickupLocationName').lean(),
    User.findOne({ sellerId, role: 'SELLER' }, 'name email phone').lean(),
  ]);
  if (!seller) throw new NotFoundError('Seller account not found.');
  const { address = null, locality = null, city = null, state = null, pincode = null } = seller.location ?? {};
  return { address, locality, city, state, pincode, contact: { name: owner?.name ?? null, phone: owner?.phone ?? null, email: owner?.email ?? null }, registeredWithCourier: Boolean(seller.pickupLocationName), courierVerified: await courierVerified(seller.pickupLocationName) };
}

/** Saves the pickup address. A changed address is registered with the courier afresh the next time a parcel is made ready to ship. */
export async function setPickupAddress(sellerId, { address, locality, city, state, pincode }, actor) {
  const before = await getPickupAddress(sellerId);
  const location = { address, locality: locality || null, city, state, pincode };
  await updateSeller(sellerId, { location }, 'location');
  await recordAudit({ action: 'seller.address.update', subjectType: 'seller', subjectId: sellerId, before: { address: before.address, city: before.city, pincode: before.pincode }, after: { address, city, pincode }, actor });
  return getPickupAddress(sellerId);
}

export async function setVacationMode(sellerId, on, actor) {
  const seller = await updateSeller(sellerId, { vacationMode: on }, 'storeName vacationMode');
  await recordAudit({ action: 'seller.vacation.set', subjectType: 'seller', subjectId: sellerId, after: { vacationMode: on }, actor });
  catalogChanged(); // the seller's listings leave (or return to) the shop for customers
  return { id: String(seller._id), storeName: seller.storeName, vacationMode: seller.vacationMode };
}

export async function getBank(sellerId) {
  const seller = await Seller.findById(sellerId, 'bank bankOk').lean();
  if (!seller) throw new NotFoundError('Seller account not found.');
  return { account: serializeBank(seller) };
}

export async function setBank(sellerId, input, actor) {
  const bank = { ...input, accountNumber: encryptField(input.accountNumber) };
  const seller = await updateSeller(sellerId, { bank, bankOk: false }, 'bank bankOk');
  await recordAudit({ action: 'seller.bank.set', subjectType: 'seller', subjectId: sellerId, after: { bank }, actor });
  return { account: serializeBank(seller) };
}

export async function clearBank(sellerId, actor) {
  await updateSeller(sellerId, { bank: NO_BANK, bankOk: false }, '_id');
  await recordAudit({ action: 'seller.bank.clear', subjectType: 'seller', subjectId: sellerId, actor });
  return { account: null };
}
