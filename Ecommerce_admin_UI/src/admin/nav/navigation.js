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
    icon: 'dashboard',
    items: [{ label: 'Dashboard', path: '/' }],
  },
  {
    key: 'catalog',
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
    key: 'orders',
    label: 'Orders',
    icon: 'shopping',
    items: [
      { label: 'Orders', path: '/orders' },
      { label: 'Returns & Replacements', path: '/returns' },
      { label: 'Shipments', path: '/logistics/shipments' },
    ],
  },
  {
    key: 'sellers',
    label: 'Sellers',
    icon: 'shop',
    items: [
      { label: 'Sellers', path: '/sellers' },
      { label: 'Seller Applications', path: '/sellers/applications' },
    ],
  },
  {
    key: 'customers',
    label: 'Customers',
    icon: 'team',
    items: [{ label: 'Customers', path: '/customers' }],
  },
  {
    key: 'marketing',
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
    key: 'finance',
    label: 'Finance',
    icon: 'bank',
    items: [
      { label: 'Payments', path: '/finance/payments' },
      { label: 'Refunds', path: '/finance/refunds' },
      { label: 'Seller Payouts', path: '/finance/payouts' },
    ],
  },
  {
    key: 'support',
    label: 'Support',
    icon: 'customerService',
    items: [
      { label: 'Support Tickets', path: '/support/tickets' },
      { label: 'Reviews & Q&A', path: '/reviews' },
    ],
  },
  {
    key: 'settings',
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
