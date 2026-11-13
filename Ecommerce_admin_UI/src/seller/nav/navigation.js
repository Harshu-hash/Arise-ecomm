/**
 * Seller-panel sidebar model. Every item is backed by a real route in the
 * router, so navigation can never fall back to a stub.
 *
 * Simplified menu: a lean, Flipkart/Amazon-style seller panel. Own-fleet
 * logistics, FBA inbound/warehouses, ads, promotions, performance claims,
 * analytics suites, team roles/API/webhooks and the heavy finance surfaces
 * have been removed. Third-party delivery integration will extend Orders later.
 */

export const NAV_GROUPS = [
  {
    key: 'overview',
    icon: 'dashboard',
    items: [{ label: 'Dashboard', path: '/' }],
  },
  {
    key: 'products',
    label: 'Products',
    icon: 'appstore',
    items: [
      { label: 'My Listings', path: '/listings' },
      { label: 'Add Product', path: '/listings/new' },
    ],
  },
  {
    key: 'orders',
    label: 'Orders',
    icon: 'shopping',
    items: [
      { label: 'Orders', path: '/orders' },
      { label: 'Returns', path: '/returns' },
    ],
  },
  {
    key: 'campaigns',
    label: 'Campaigns',
    icon: 'thunderbolt',
    items: [{ label: 'Campaigns', path: '/campaigns' }],
  },
  {
    key: 'payments',
    label: 'Payments',
    icon: 'bank',
    items: [{ label: 'Payments & Settlements', path: '/payments' }],
  },
  {
    key: 'account',
    label: 'Account',
    icon: 'setting',
    items: [
      { label: 'Business Profile', path: '/settings/profile' },
      { label: 'Bank Account', path: '/settings/bank' },
      { label: 'Support', path: '/support' },
    ],
  },
];

export const ALL_NAV_ITEMS = NAV_GROUPS.flatMap((g) =>
  g.items.map((i) => ({ ...i, groupKey: g.key, groupLabel: g.label })),
);

export function navItemForPath(path) {
  return ALL_NAV_ITEMS.find((i) => i.path === path) ?? null;
}
