/**
 * Seller-panel permission catalog (Phase S1).
 *
 * Deliberately smaller and flatter than the admin catalog: a seller org has an
 * account owner plus a handful of staff roles, not the platform's granular
 * maker-checker matrix. Keys follow the same `module.resource.action` shape so
 * the shared `@core/rbac` engine (`Can`, `useCan`, `checkPermission`) works
 * unchanged — only the data differs.
 *
 * Screens land across phases S1–S8; the keys exist now so each later phase adds
 * pages, not permissions, and the sidebar gates correctly from day one.
 */

export const SELLER_PERMISSION_MODULES = [
  {
    key: 'media',
    label: 'Media & documents',
    resources: [
      { key: 'upload', label: 'Uploads', actions: ['create', 'delete'] },
      { key: 'media', label: 'Media resources', actions: ['view'] },
    ],
  },
  {
    key: 'exports',
    label: 'Export jobs',
    resources: [{ key: 'job', label: 'Export jobs', actions: ['view', 'create'] }],
  },
  {
    key: 'dashboard',
    label: 'Dashboard',
    resources: [{ key: 'dashboard', label: 'Dashboard', actions: ['view'] }],
  },
  {
    key: 'listings',
    label: 'Listings',
    resources: [
      { key: 'product', label: 'Products', actions: ['view', 'create', 'edit', 'delete'] },
      { key: 'price', label: 'Price', actions: ['edit'] },
      { key: 'stock', label: 'Stock', actions: ['edit'] },
      { key: 'brand', label: 'Brand requests', actions: ['request'] },
    ],
  },
  {
    key: 'orders',
    label: 'Orders',
    resources: [
      { key: 'order', label: 'Orders', actions: ['view', 'process', 'cancel'] },
      { key: 'label', label: 'Shipping labels', actions: ['generate'] },
      { key: 'return', label: 'Returns', actions: ['manage'] },
    ],
  },
  {
    key: 'inventory',
    label: 'Inventory',
    resources: [
      { key: 'stock', label: 'Inventory', actions: ['view', 'edit'] },
      { key: 'inbound', label: 'FBA inbound', actions: ['manage'] },
    ],
  },
  {
    key: 'finance',
    label: 'Payments',
    resources: [
      { key: 'payout', label: 'Payouts', actions: ['view'] },
      { key: 'transaction', label: 'Transactions', actions: ['view'] },
      { key: 'invoice', label: 'Invoices', actions: ['view'] },
      { key: 'tax', label: 'Tax', actions: ['view'] },
      { key: 'reconciliation', label: 'Reconciliation', actions: ['view', 'dispute'] },
      { key: 'fee', label: 'Fees and commission', actions: ['view'] },
    ],
  },
  {
    key: 'ads',
    label: 'Advertising',
    resources: [
      { key: 'campaign', label: 'Campaigns', actions: ['view', 'manage'] },
      { key: 'billing', label: 'Ad billing', actions: ['view'] },
    ],
  },
  {
    key: 'promotions',
    label: 'Promotions',
    resources: [
      { key: 'deal', label: 'Deals', actions: ['manage'] },
      { key: 'coupon', label: 'Coupons', actions: ['manage'] },
    ],
  },
  {
    key: 'performance',
    label: 'Performance',
    resources: [
      { key: 'health', label: 'Account health', actions: ['view'] },
      { key: 'claim', label: 'Claims', actions: ['view', 'create'] },
      { key: 'penalty', label: 'Penalties', actions: ['view', 'dispute'] },
    ],
  },
  {
    key: 'support',
    label: 'Support',
    resources: [{ key: 'ticket', label: 'Tickets', actions: ['view', 'manage'] }],
  },
  {
    key: 'reports',
    label: 'Reports',
    resources: [{ key: 'report', label: 'Reports', actions: ['view'] }],
  },
  {
    key: 'settings',
    label: 'Settings',
    resources: [
      { key: 'profile', label: 'Business profile', actions: ['view', 'edit'] },
      { key: 'bank', label: 'Bank accounts', actions: ['manage'] },
      { key: 'pickup', label: 'Pickup addresses', actions: ['manage'] },
      { key: 'user', label: 'Users & roles', actions: ['view', 'manage'] },
      { key: 'notification', label: 'Notifications', actions: ['manage'] },
      { key: 'vacation', label: 'Holiday mode', actions: ['manage'] },
    ],
  },
  // Namespaces are frozen in S9 so later phases can add routes without
  // inventing policy names in display code.
  {
    key: 'onboarding', label: 'Onboarding', resources: [
      { key: 'application', label: 'Application', actions: ['view', 'edit', 'submit', 'resubmit'] },
      { key: 'document', label: 'KYC documents', actions: ['view', 'upload', 'replace'] },
      { key: 'agreement', label: 'Agreements', actions: ['view', 'accept'] },
      { key: 'change_request', label: 'Verified detail changes', actions: ['view', 'create'] },
    ],
  },
  {
    key: 'catalog', label: 'Marketplace catalog', resources: [
      { key: 'product', label: 'Canonical products', actions: ['view', 'match', 'propose'] },
      { key: 'bulk_job', label: 'Catalog bulk jobs', actions: ['view', 'create', 'retry'] },
    ],
  },
  {
    key: 'logistics', label: 'Logistics', resources: [
      { key: 'shipment', label: 'Shipments', actions: ['view', 'pack', 'handover'] },
      { key: 'document', label: 'Fulfilment documents', actions: ['view', 'generate'] },
      { key: 'pickup', label: 'Pickups', actions: ['view', 'manage'] },
      { key: 'ndr', label: 'NDR', actions: ['view', 'respond'] },
      { key: 'rto', label: 'RTO', actions: ['view'] },
      { key: 'weight_dispute', label: 'Weight disputes', actions: ['view', 'create'] },
    ],
  },
  {
    key: 'returns', label: 'Returns & disputes', resources: [
      { key: 'return', label: 'Returns', actions: ['view', 'decide', 'receive', 'qc'] },
      { key: 'dispute', label: 'Return disputes', actions: ['view', 'create'] },
    ],
  },
  {
    key: 'customer_experience', label: 'Customer experience', resources: [
      { key: 'review', label: 'Reviews', actions: ['view', 'reply', 'report'] },
      { key: 'question', label: 'Questions', actions: ['view', 'answer'] },
      { key: 'message', label: 'Buyer messages', actions: ['view', 'reply'] },
    ],
  },
  {
    key: 'analytics', label: 'Analytics', resources: [
      { key: 'dashboard', label: 'Analytics dashboards', actions: ['view', 'export'] },
      { key: 'recommendation', label: 'Recommendations', actions: ['view', 'apply', 'dismiss', 'snooze'] },
    ],
  },
  {
    key: 'security', label: 'Security & integrations', resources: [
      { key: 'session', label: 'Sessions', actions: ['view', 'revoke'] },
      { key: 'role', label: 'Custom roles', actions: ['view', 'manage'] },
      { key: 'api_key', label: 'API keys', actions: ['view', 'create', 'rotate', 'revoke'] },
      { key: 'webhook', label: 'Webhooks', actions: ['view', 'manage', 'retry'] },
      { key: 'audit', label: 'Seller audit log', actions: ['view', 'export'] },
    ],
  },
];

/** Flat list of every seller permission key, e.g. `listings.product.edit`. */
export const SELLER_PERMISSION_KEYS = SELLER_PERMISSION_MODULES.flatMap((m) =>
  m.resources.flatMap((r) => r.actions.map((a) => `${m.key}.${r.key}.${a}`)),
);

const keysFor = (prefixes) =>
  SELLER_PERMISSION_KEYS.filter((k) => prefixes.some((p) => k === p || k.startsWith(`${p}.`)));

/**
 * Seller staff roles. The owner (and anyone with the Admin role) holds every
 * permission; the rest are job-shaped subsets used when inviting sub-users.
 */
export const SELLER_ROLE_TEMPLATES = [
  {
    key: 'owner',
    name: 'Account Owner',
    description: 'Full access to the seller account, including users and settings.',
    system: true,
    permissions: ['*'],
  },
  {
    key: 'admin',
    name: 'Admin',
    description: 'Everything except transferring account ownership.',
    system: true,
    permissions: ['*'],
  },
  {
    key: 'catalog_manager',
    name: 'Catalog Manager',
    description: 'Manage listings, prices and inventory.',
    permissions: keysFor(['dashboard', 'listings', 'catalog', 'inventory', 'media', 'exports']),
  },
  {
    key: 'order_manager',
    name: 'Order Manager',
    description: 'Process orders, shipping and returns.',
    permissions: keysFor(['dashboard', 'orders', 'logistics', 'returns', 'inventory.stock', 'media', 'exports']),
  },
  {
    key: 'finance_viewer',
    name: 'Finance Viewer',
    description: 'View payments, invoices, tax and reports.',
    permissions: keysFor(['dashboard', 'finance', 'reports', 'exports']),
  },
  {
    key: 'ads_manager',
    name: 'Ads Manager',
    description: 'Run advertising campaigns and promotions.',
    permissions: keysFor(['dashboard', 'ads', 'promotions', 'analytics', 'exports']),
  },
];

/** Resolves a role key to its concrete permission key list. */
export function permissionsForRole(roleKey) {
  const role = SELLER_ROLE_TEMPLATES.find((r) => r.key === roleKey);
  if (!role) return [];
  return role.permissions.includes('*') ? ['*'] : role.permissions;
}
