import { filter, find, findById, id, insert, update } from '@mocks/db/store';
import { mockNowIso } from '@mocks/engine/settings';
import { permissionsForRole, SELLER_ROLE_TEMPLATES } from '@seller/rbac/permissions';

/**
 * Seller settings over the shared `sellers`, `kycDocuments`, `pickupAddresses`,
 * `bankAccounts` and `sellerUsers` collections — the exact records admin KYC
 * review and Seller 360 already read, so an edit here is the same row the
 * admin side sees, not a shadow copy.
 */

export function profileFor(sellerId) {
  const seller = findById('sellers', sellerId);
  const documents = filter('kycDocuments', (d) => d.sellerId === sellerId);
  return { seller, documents };
}

export function updateProfile(seller, body) {
  const patch = {};
  for (const key of ['storeName', 'legalName']) {
    if (body?.[key]) patch[key] = body[key];
  }
  update('sellers', seller.id, patch);
  return findById('sellers', seller.id);
}

export function setVacationMode(seller, on) {
  update('sellers', seller.id, { vacationMode: Boolean(on), vacationSetAt: mockNowIso() });
  return findById('sellers', seller.id);
}

/* ---------------------------------------------------------- bank & pickup */

export function pickupAddressesFor(sellerId) {
  return filter('pickupAddresses', (p) => p.sellerId === sellerId);
}

export function addPickupAddress(seller, body) {
  const required = ['line1', 'city', 'state', 'pincode', 'contactName', 'contactPhone'];
  for (const key of required) {
    if (!String(body?.[key] ?? '').trim()) return { error: `Fill in ${key}.` };
  }
  const makePrimary = Boolean(body?.isPrimary) || pickupAddressesFor(seller.id).length === 0;
  if (makePrimary) {
    for (const p of pickupAddressesFor(seller.id)) update('pickupAddresses', p.id, { isPrimary: false });
  }
  const row = insert('pickupAddresses', {
    id: id('PCK', 6),
    sellerId: seller.id,
    label: body.label || 'Pickup address',
    line1: body.line1,
    line2: body.line2 ?? '',
    city: body.city,
    state: body.state,
    pincode: body.pincode,
    contactName: body.contactName,
    contactPhone: body.contactPhone,
    isPrimary: makePrimary,
    geoVerified: false,
    serviceableCouriers: [],
    version: 1,
  });
  return { address: row };
}

export function bankAccountFor(sellerId) {
  return find('bankAccounts', (b) => b.sellerId === sellerId);
}

export function setBankAccount(seller, body) {
  const required = ['accountHolder', 'accountNumber', 'ifsc', 'bankName'];
  for (const key of required) {
    if (!String(body?.[key] ?? '').trim()) return { error: `Fill in ${key}.` };
  }
  const existing = bankAccountFor(seller.id);
  const patch = {
    accountHolder: body.accountHolder,
    accountNumber: body.accountNumber,
    ifsc: body.ifsc.toUpperCase(),
    bankName: body.bankName,
    branch: body.branch ?? null,
    pennyDropStatus: 'PENDING',
    nameMatchPct: null,
  };
  if (existing) {
    update('bankAccounts', existing.id, patch);
    return { account: findById('bankAccounts', existing.id) };
  }
  const row = insert('bankAccounts', { id: id('BNK', 6), sellerId: seller.id, ...patch, version: 1 });
  return { account: row };
}

/* ----------------------------------------------------------- sub-users */

export function sellerTeam(sellerId) {
  return filter('sellerUsers', (u) => u.sellerId === sellerId);
}

export function inviteUser(seller, body) {
  const email = String(body?.email ?? '').trim().toLowerCase();
  if (!email || !email.includes('@')) return { error: 'Enter a valid email.' };
  if (find('sellerUsers', (u) => u.email.toLowerCase() === email)) return { error: 'This email is already on your team (or another account).' };
  const role = SELLER_ROLE_TEMPLATES.find((r) => r.key === body?.roleKey);
  if (!role || role.key === 'owner') return { error: 'Choose a role to invite them as.' };

  const user = insert('sellerUsers', {
    id: id('SUSR', 4),
    sellerId: seller.id,
    name: body.name || email.split('@')[0],
    email,
    phone: body.phone ?? null,
    password: null,
    avatarColor: '#4F46E5',
    status: 'INVITED',
    roleKey: role.key,
    roleName: role.name,
    storeName: seller.storeName,
    permissions: permissionsForRole(role.key),
    mustChangePassword: false,
    notifyEmail: true,
    notifyInPanel: true,
    lastLoginAt: null,
    createdAt: mockNowIso(),
    inviteToken: `invite_${id('TOK', 6)}`,
    version: 1,
  });
  return { user };
}

export function revokeUser(seller, targetUser) {
  if (targetUser.roleKey === 'owner') return { error: 'The account owner cannot be removed.' };
  update('sellerUsers', targetUser.id, { status: 'DEACTIVATED' });
  return { user: findById('sellerUsers', targetUser.id) };
}

export function updateNotificationPrefs(user, body) {
  const patch = {};
  if (typeof body?.notifyEmail === 'boolean') patch.notifyEmail = body.notifyEmail;
  if (typeof body?.notifyInPanel === 'boolean') patch.notifyInPanel = body.notifyInPanel;
  update('sellerUsers', user.id, patch);
  return findById('sellerUsers', user.id);
}
