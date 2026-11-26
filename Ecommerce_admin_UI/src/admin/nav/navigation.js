/**
 * The sidebar. This is also the source the router uses, so a nav item can
 * never point at a 404 — every path here has a real route in the router.
 *
 * Each item lists the catalog resources ("module.resource", see @core/rbac/permissions.data.js)
 * it controls in `resources`. That one list drives three things with no further wiring: the
 * sidebar shows the item only to admins holding any permission on those resources, the route guard
 * blocks the page for everyone else, and the Roles editor gets a row for it (see ./access.js).
 * A new item without `resources` fails nav/access.test.js.
 *
 * Simplified menu: a lean, Flipkart/Amazon-style marketplace admin aimed at
 * Indian sellers. Own-fleet logistics, warehouses/FBA, wallet, sponsored ads
 * and the heavy finance/reports surfaces have been removed. Third-party
 * delivery integration will add to the Orders group later.
 */

export const NAV_GROUPS = [
  {
    key: 'overview',
    section: 'Overview',
    icon: 'dashboard',
    items: [{ label: 'Dashboard', path: '/', resources: ['dashboard.dashboard', 'dashboard.finance_widgets', 'dashboard.action_center'] }],
  },
  {
    key: 'analytics',
    section: 'Overview',
    icon: 'barChart',
    items: [{ label: 'Analytics', path: '/analytics', resources: ['reports.sales', 'reports.operations', 'reports.finance'] }],
  },
  {
    key: 'catalog',
    section: 'Catalog & Growth',
    label: 'Catalog',
    icon: 'appstore',
    items: [
      { label: 'Products', path: '/catalog/products', resources: ['catalog.product'] },
      { label: 'Categories', path: '/catalog/categories', resources: ['catalog.category'] },
      { label: 'Brands', path: '/catalog/brands', resources: ['catalog.brand'] },
      { label: 'Attributes', path: '/catalog/attributes', resources: ['catalog.attribute'] },
      { label: 'Size Charts', path: '/catalog/size-charts', resources: ['catalog.sizechart'] },
    ],
  },
  {
    key: 'marketing',
    section: 'Catalog & Growth',
    label: 'Marketing',
    icon: 'notification',
    items: [
      { label: 'Campaigns', path: '/campaigns', resources: ['marketing.campaign'] },
      { label: 'Shop Banner Ads', path: '/marketing/banner-ads', resources: ['ads.review', 'ads.placement'] },
      { label: 'Push Notifications', path: '/marketing/push-notifications', resources: ['notifications.broadcast'] },
      { label: 'Coupons', path: '/marketing/coupons', resources: ['marketing.coupon'] },
      { label: 'Offers', path: '/marketing/deals', resources: ['marketing.deal'] },
    ],
  },
  {
    key: 'rewards',
    section: 'Catalog & Growth',
    label: 'Rewards',
    icon: 'wallet',
    items: [
      { label: 'Refer & Earn', path: '/marketing/referrals', resources: ['marketing.referral'] },
      { label: 'Gift Cards', path: '/marketing/gift-cards', resources: ['wallet.giftcard'] },
      { label: 'Cashback Rules', path: '/marketing/cashback', resources: ['wallet.cashback'] },
    ],
  },
  {
    key: 'content',
    section: 'Catalog & Growth',
    label: 'Content',
    icon: 'layout',
    items: [
      { label: 'Banners', path: '/cms/banners', resources: ['cms.banner'] },
      { label: 'Home Layout', path: '/cms/home', resources: ['cms.home'] },
      { label: 'Pages', path: '/cms/pages', resources: ['cms.page'] },
      { label: 'About Arise', path: '/cms/about-arise', resources: ['cms.page'] },
    ],
  },
  {
    key: 'orders',
    section: 'Orders & Support',
    label: 'Orders',
    icon: 'shopping',
    items: [
      { label: 'Orders', path: '/orders', resources: ['orders.order', 'orders.item'] },
      { label: 'Returns & Replacements', path: '/returns', resources: ['orders.return'] },
      { label: 'Shipments', path: '/logistics/shipments', resources: ['logistics.shipment'] },
    ],
  },
  {
    key: 'support',
    section: 'Orders & Support',
    label: 'Support',
    icon: 'customerService',
    items: [
      { label: 'Live Chat', path: '/support/chat', resources: ['support.chat'] },
      { label: 'Arise ratings', path: '/support/arise-ratings', resources: ['support.csat'] },
      { label: 'Reviews & Q&A', path: '/reviews', resources: ['reviews.review', 'reviews.qa', 'reviews.abuse'] },
    ],
  },
  {
    key: 'sellers',
    section: 'People',
    label: 'Sellers',
    icon: 'shop',
    items: [
      { label: 'Sellers', path: '/sellers', resources: ['sellers.seller', 'sellers.bank', 'sellers.penalty', 'sellers.claim'] },
      { label: 'Seller Applications', path: '/sellers/applications', resources: ['sellers.application', 'sellers.kyc'] },
      { label: 'Seller inquiries', path: '/sellers/inquiries', resources: ['sellers.application'] },
    ],
  },
  {
    key: 'customers',
    section: 'People',
    label: 'Customers',
    icon: 'team',
    items: [{ label: 'Customers', path: '/customers', resources: ['customers.customer', 'customers.pii'] }],
  },
  {
    key: 'finance',
    section: 'Finance',
    label: 'Finance',
    icon: 'bank',
    items: [
      { label: 'Payments', path: '/finance/payments', resources: ['finance.payment'] },
      { label: 'Refunds', path: '/finance/refunds', resources: ['finance.refund'] },
      { label: 'Invoices', path: '/finance/invoices', resources: ['finance.invoice'] },
      { label: 'Seller Settlements', path: '/finance/payouts', resources: ['finance.payout'] },
      { label: 'Withdrawals', path: '/finance/withdrawals', resources: ['finance.payout'] },
    ],
  },
  {
    key: 'roles',
    section: 'System',
    icon: 'safety',
    items: [{ label: 'Roles & Permissions', path: '/admin/roles', resources: ['admin.role'] }],
  },
  {
    key: 'settings',
    section: 'System',
    label: 'Settings',
    icon: 'setting',
    items: [
      { label: 'Settings', path: '/admin/settings', resources: ['admin.settings'] },
      { label: 'Staff', path: '/admin/users', resources: ['admin.user'] },
      { label: 'Approvals', path: '/admin/approvals', resources: ['admin.approval'] },
    ],
  },
];

export const ALL_NAV_ITEMS = NAV_GROUPS.flatMap((g) =>
  g.items.map((i) => ({ ...i, groupKey: g.key, groupLabel: g.label })),
);

export function navItemForPath(path) {
  return ALL_NAV_ITEMS.find((i) => i.path === path) ?? null;
}
