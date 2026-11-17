/**
 * Seller-panel sidebar model. Every item is backed by a real route in the
 * router, so navigation can never fall back to a stub.
 *
 * Simplified menu: a lean, Flipkart/Amazon-style seller panel. Own-fleet
 * logistics, FBA inbound/warehouses, performance claims, team roles/API/webhooks
 * and the heavy finance surfaces have been removed.
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
    items: [
      { label: 'Analytics', path: '/analytics' },
      { label: 'Sales Report', path: '/reports/sales' },
    ],
  },
  {
    key: 'products',
    section: 'Catalog & Growth',
    label: 'Products',
    icon: 'appstore',
    items: [
      { label: 'My Listings', path: '/listings' },
      { label: 'Add Product', path: '/listings/new' },
      { label: 'Stock Management', path: '/stock' },
    ],
  },
  {
    key: 'campaigns',
    section: 'Catalog & Growth',
    label: 'Campaigns',
    icon: 'thunderbolt',
    items: [
      { label: 'Campaigns', path: '/campaigns' },
      { label: 'Shop Banner Ads', path: '/banner-ads' },
    ],
  },
  {
    key: 'orders',
    section: 'Orders & Support',
    label: 'Orders',
    icon: 'shopping',
    items: [
      { label: 'Orders', path: '/orders' },
      { label: 'Returns', path: '/returns' },
    ],
  },
  {
    key: 'payments',
    section: 'Finance',
    label: 'Payments',
    icon: 'bank',
    items: [
      { label: 'Overview', path: '/payments' },
      { label: 'Settlements', path: '/payments/settlements' },
    ],
  },
  {
    key: 'support',
    section: 'Orders & Support',
    label: 'Support',
    icon: 'customerService',
    items: [
      { label: 'My Support Tickets', path: '/support' },
      { label: 'Customer Complaints', path: '/support/customer-complaints' },
    ],
  },
  {
    key: 'account',
    section: 'System',
    label: 'Account',
    icon: 'setting',
    items: [
      { label: 'Business Profile', path: '/settings/profile' },
      { label: 'Bank Account', path: '/settings/bank' },
    ],
  },
];

export const ALL_NAV_ITEMS = NAV_GROUPS.flatMap((g) =>
  g.items.map((i) => ({ ...i, groupKey: g.key, groupLabel: g.label })),
);

export function navItemForPath(path) {
  return ALL_NAV_ITEMS.find((i) => i.path === path) ?? null;
}
