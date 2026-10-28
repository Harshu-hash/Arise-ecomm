import { avatarColor } from '@core/utils/misc';
import { db, id, insert } from '@mocks/db/store';
import { mockNow, mockNowIso } from '@mocks/engine/settings';
import { permissionsForRole } from '@seller/rbac/permissions';

/**
 * Seller-panel login accounts, linked to sellers already seeded in the shared
 * DB. Run by the seller app's mock bootstrap after the shared `seedAll` (which
 * creates the `sellers` rows). Idempotent: a no-op if accounts already exist,
 * so it is safe to call against a restored snapshot.
 *
 * The shared demo password matches the admin panel's, because this is a mock.
 */
export const SELLER_DEMO_PASSWORD = 'Arise@123456';

function makeUser({ sellerId, name, email, phone, roleKey, roleName, storeName, status = 'ACTIVE', mustChange = false }) {
  return insert('sellerUsers', {
    id: id('SUSR', 4),
    sellerId,
    name,
    email,
    phone: phone ?? null,
    password: SELLER_DEMO_PASSWORD,
    avatarColor: avatarColor(email),
    status,
    roleKey,
    roleName,
    storeName: storeName ?? null,
    permissions: permissionsForRole(roleKey),
    mustChangePassword: mustChange,
    notifyEmail: true,
    notifyInPanel: true,
    lastLoginAt: new Date(mockNow() - 3600_000).toISOString(),
    createdAt: mockNowIso(),
    version: 1,
  });
}

export function seedSellerAccounts() {
  if (db.sellerUsers.length > 0) return db.sellerUsers;

  const activeSellers = db.sellers.filter((s) => s.status === 'ACTIVE');
  const primary = activeSellers[0];
  const second = activeSellers[1] ?? primary;

  if (primary) {
    // Primary demo: the account owner of an established, live store.
    makeUser({
      sellerId: primary.id,
      name: 'Harsh (Owner)',
      email: 'owner@arise.test',
      phone: '+91 90000 00001',
      roleKey: 'owner',
      roleName: 'Account Owner',
      storeName: primary.storeName,
    });

    // A catalog-only sub-user on the same store, to demonstrate scoped roles.
    makeUser({
      sellerId: primary.id,
      name: 'Priya (Catalog)',
      email: 'catalog@arise.test',
      phone: '+91 90000 00002',
      roleKey: 'catalog_manager',
      roleName: 'Catalog Manager',
      storeName: primary.storeName,
    });
  }

  if (second) {
    // An order-desk sub-user on a second active store.
    makeUser({
      sellerId: second.id,
      name: 'Rahul (Orders)',
      email: 'orders@arise.test',
      phone: '+91 90000 00003',
      roleKey: 'order_manager',
      roleName: 'Order Manager',
      storeName: second.storeName,
    });
  }

  // A brand-new seller mid-onboarding: no live store yet, wizard not finished,
  // so the shell routes them to /onboarding until an admin approves them.
  const pendingSellerId = id('SEL', 4);
  insert('sellers', {
    id: pendingSellerId,
    storeName: 'Nova Essentials',
    legalName: 'Nova Essentials Pvt Ltd',
    status: 'ONBOARDING',
    tier: 'BRONZE',
    gstin: null,
    pan: null,
    city: 'Surat',
    state: 'GJ',
    pincode: '395007',
    rating: null,
    liveListings: 0,
    gmv30dPaise: 0,
    orders30d: 0,
    cancellationPct: 0,
    lateDispatchPct: 0,
    returnPct: 0,
    payoutOnHold: false,
    accountManagerId: null,
    fulfillmentTypes: ['SELLER'],
    appliedAt: mockNowIso(),
    joinedAt: null,
    version: 1,
  });
  insert('sellerOnboarding', {
    id: id('ONB', 4),
    sellerId: pendingSellerId,
    status: 'DRAFT',
    step: 1,
    business: { storeName: 'Nova Essentials', legalName: 'Nova Essentials Pvt Ltd', category: null },
    tax: { gstin: null, pan: null },
    bank: null,
    pickup: null,
    agreementAcceptedAt: null,
    submittedAt: null,
    createdAt: mockNowIso(),
    updatedAt: mockNowIso(),
    version: 1,
  });
  makeUser({
    sellerId: pendingSellerId,
    name: 'Nova Owner',
    email: 'newseller@arise.test',
    phone: '+91 90000 00004',
    roleKey: 'owner',
    roleName: 'Account Owner',
    storeName: 'Nova Essentials',
    status: 'ACTIVE',
  });

  return db.sellerUsers;
}
