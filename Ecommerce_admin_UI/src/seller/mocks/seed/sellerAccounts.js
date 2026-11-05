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
    twoFactorEnrolled: true,
    twoFactorSecret: `ARISESELLER${email.replace(/[^A-Z0-9]/gi, '').toUpperCase()}`,
    backupCodes: [
      { code: 'SELL-1001', usedAt: null },
      { code: 'SELL-1002', usedAt: null },
      { code: 'SELL-1003', usedAt: null },
      { code: 'SELL-1004', usedAt: null },
    ],
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

  // Shared, privacy-safe buyer conversations and platform notices used by
  // Customer Experience and Support. Customer identity is never copied into
  // the seller projection; only the masked label is retained here.
  for (const seller of [primary, second].filter(Boolean)) {
    const item = db.orderItems.find((row) => row.sellerId === seller.id && row.status === 'DELIVERED');
    if (!item) continue;
    const conversation = insert('customerConversations', {
      id: id('CONV', 6), sellerId: seller.id, customerId: db.orders.find((row) => row.id === item.orderId)?.customerId,
      customerMaskedName: 'Buyer ••••', orderId: item.orderId, orderItemId: item.id, productId: item.productId,
      productTitle: item.name, status: 'OPEN', policy: 'TRANSACTION_ONLY', lastMessageAt: mockNowIso(), version: 1,
    });
    insert('customerMessages', { id: id('CMSG', 7), conversationId: conversation.id, authorType: 'CUSTOMER', authorName: 'Buyer', body: 'Could you confirm what is included in the box?', attachments: [], moderationStatus: 'VISIBLE', createdAt: mockNowIso(), version: 1 });

    const offers = db.offers.filter((row) => row.sellerId === seller.id).slice(0, 12);
    offers.forEach((offer, offerIndex) => {
      const variant = db.variants.find((row) => row.id === offer.variantId);
      for (let daysAgo = 1; daysAgo <= 45; daysAgo += 1) {
        const impressions = 80 + ((offerIndex + 3) * (daysAgo + 11)) % 420;
        const productViews = Math.round(impressions * (0.22 + (offerIndex % 4) * 0.03));
        const addsToCart = Math.round(productViews * 0.24);
        const checkouts = Math.round(addsToCart * 0.62);
        insert('customerFunnelEvents', { id: id('FNL', 8), sellerId: seller.id, productId: offer.productId ?? variant?.productId, offerId: offer.id, sku: offer.sku, date: new Date(mockNow() - daysAgo * 86400_000).toISOString().slice(0, 10), impressions, productViews, addsToCart, checkouts, source: ['SEARCH', 'CATEGORY', 'ADS'][offerIndex % 3], version: 1 });
      }
    });
    const recommendationTypes = ['RESTOCK', 'IMPROVE_CONTENT', 'CHANGE_PRICE', 'JOIN_PROMOTION', 'FIX_SLA', 'ANSWER_QUESTION'];
    recommendationTypes.forEach((type, index) => insert('sellerRecommendations', { id: id('REC', 6), sellerId: seller.id, type, title: type.replaceAll('_', ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase()), rationale: `Generated from ${type === 'RESTOCK' ? 'stock velocity and days of cover' : type === 'FIX_SLA' ? 'dispatch SLA events' : type === 'ANSWER_QUESTION' ? 'unanswered customer questions' : 'shared marketplace performance facts'}.`, provenance: type === 'RESTOCK' ? 'INVENTORY_VELOCITY_V1' : type === 'ANSWER_QUESTION' ? 'CUSTOMER_QA_V1' : 'SELLER_GROWTH_V1', targetType: index < 3 ? 'LISTING' : type === 'ANSWER_QUESTION' ? 'QUESTION' : 'SELLER', targetId: index < 3 ? offers[index]?.id : seller.id, actionPath: index < 3 ? `/listings/${offers[index]?.id}` : type === 'JOIN_PROMOTION' ? '/promotions' : type === 'ANSWER_QUESTION' ? '/customer-experience/questions' : '/orders/processing', estimatedImpact: index % 2 ? '+3–7% conversion' : 'Reduce lost sales', status: 'OPEN', snoozedUntil: null, outcome: null, createdAt: mockNowIso(), updatedAt: mockNowIso(), version: 1 }));
  }
  insert('supportIncidents', { id: 'INC-SELLER-PANEL', title: 'Seller services operational', body: 'No active incidents are affecting orders, payouts or support.', status: 'OPERATIONAL', severity: 'info', startedAt: mockNowIso(), resolvedAt: mockNowIso(), version: 1 });

  return db.sellerUsers;
}
