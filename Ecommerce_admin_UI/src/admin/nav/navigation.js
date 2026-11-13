/**
 * The sidebar. This is also the source the router uses, so a nav item can
 * never point at a 404 — every path here has a real route in the router.
 *
 * Simplified menu: a lean, Flipkart/Amazon-style marketplace admin aimed at
 * Indian sellers. Own-fleet logistics, warehouses/FBA, wallet, sponsored ads,
 * RBAC role management and the heavy finance/reports surfaces have been
 * removed. Third-party delivery integration will add to the Orders group later.
 */

export const NAV_GROUPS = [
  {
    key: 'overview',
    section: 'Overview',
    icon: 'dashboard',
    items: [{ label: 'Dashboard', path: '/' }],
  },
  {
    key: 'analytics',
    section: 'Overview',
    icon: 'barChart',
    items: [{ label: 'Analytics', path: '/analytics' }],
  },
  {
    key: 'catalog',
    section: 'Catalog & Growth',
    label: 'Catalog',
    icon: 'appstore',
    items: [
      { label: 'Products', path: '/catalog/products' },
      { label: 'Categories', path: '/catalog/categories' },
      { label: 'Brands', path: '/catalog/brands' },
      { label: 'Attributes', path: '/catalog/attributes' },
      { label: 'Size Charts', path: '/catalog/size-charts' },
    ],
  },
  {
    key: 'marketing',
    section: 'Catalog & Growth',
    label: 'Marketing',
    icon: 'notification',
    items: [
      { label: 'Campaigns', path: '/campaigns' },
      { label: 'Coupons', path: '/marketing/coupons' },
      { label: 'Offers', path: '/marketing/deals' },
      { label: 'Banners', path: '/cms/banners' },
      { label: 'Home Layout', path: '/cms/home' },
      { label: 'Pages', path: '/cms/pages' },
    ],
  },
  {
    key: 'orders',
    section: 'Orders & Support',
    label: 'Orders',
    icon: 'shopping',
    items: [
      { label: 'Orders', path: '/orders' },
      { label: 'Returns & Replacements', path: '/returns' },
      { label: 'Shipments', path: '/logistics/shipments' },
    ],
  },
  {
    key: 'support',
    section: 'Orders & Support',
    label: 'Support',
    icon: 'customerService',
    items: [
      { label: 'Support Tickets', path: '/support/tickets' },
      { label: 'Reviews & Q&A', path: '/reviews' },
    ],
  },
  {
    key: 'sellers',
    section: 'People',
    label: 'Sellers',
    icon: 'shop',
    items: [
      { label: 'Sellers', path: '/sellers' },
      { label: 'Seller Applications', path: '/sellers/applications' },
    ],
  },
  {
    key: 'customers',
    section: 'People',
    label: 'Customers',
    icon: 'team',
    items: [{ label: 'Customers', path: '/customers' }],
  },
  {
    key: 'finance',
    section: 'Finance',
    label: 'Finance',
    icon: 'bank',
    items: [
      { label: 'Payments', path: '/finance/payments' },
      { label: 'Refunds', path: '/finance/refunds' },
      { label: 'Seller Settlements', path: '/finance/payouts' },
    ],
  },
  {
    key: 'settings',
    section: 'System',
    label: 'Settings',
    icon: 'setting',
    items: [
      { label: 'Settings', path: '/admin/settings' },
      { label: 'Staff', path: '/admin/users' },
    ],
  },
];

export const ALL_NAV_ITEMS = NAV_GROUPS.flatMap((g) =>
  g.items.map((i) => ({ ...i, groupKey: g.key, groupLabel: g.label })),
);

export function navItemForPath(path) {
  return ALL_NAV_ITEMS.find((i) => i.path === path) ?? null;
}
