/**
 * Seller-panel sidebar model. Every item is asserted against a concrete route
 * in routes.test.js, so navigation can never silently fall back to a stub.
 *
 * `phase` is the seller roadmap phase (S1–S8) that implements the screen.
 */

export const CURRENT_PHASE = 18;

export const NAV_GROUPS = [
  {
    key: 'overview',
    icon: 'dashboard',
    items: [{ label: 'Dashboard', path: '/', perm: 'dashboard.dashboard.view', phase: 1 }],
  },
  {
    key: 'listings',
    label: 'Listings',
    icon: 'appstore',
    items: [
      { label: 'My Listings', path: '/listings', perm: 'listings.product.view', phase: 2 },
      { label: 'Add Product', path: '/listings/new', perm: 'listings.product.create', phase: 2 },
      { label: 'Bulk Upload', path: '/listings/bulk', perm: 'listings.product.create', phase: 2 },
      {
        label: 'Brand & Category Requests',
        path: '/listings/requests',
        perm: 'listings.brand.request',
        phase: 2,
      },
    ],
  },
  {
    key: 'orders',
    label: 'Orders',
    icon: 'shopping',
    items: [
      { label: 'All Orders', path: '/orders', perm: 'orders.order.view', phase: 3 },
      {
        label: 'Dispatch Queue',
        path: '/orders/processing',
        perm: 'logistics.shipment.view',
        phase: 12,
      },
      {
        label: 'Shipments',
        path: '/logistics/shipments',
        perm: 'logistics.shipment.view',
        phase: 12,
      },
      {
        label: 'Pickups & Manifests',
        path: '/logistics/pickups',
        perm: 'logistics.pickup.view',
        phase: 12,
      },
      { label: 'NDR', path: '/logistics/ndr', perm: 'logistics.ndr.view', phase: 12 },
      { label: 'RTO', path: '/logistics/rto', perm: 'logistics.rto.view', phase: 12 },
      {
        label: 'Weight Disputes',
        path: '/logistics/weight-disputes',
        perm: 'logistics.weight_dispute.view',
        phase: 12,
      },
      { label: 'Returns & Replacements', path: '/returns', perm: 'orders.return.manage', phase: 4 },
      {
        label: 'Cancellations',
        path: '/orders/cancellations',
        perm: 'orders.order.cancel',
        phase: 3,
      },
    ],
  },
  {
    key: 'inventory',
    label: 'Inventory',
    icon: 'inbox',
    items: [
      { label: 'Inventory', path: '/inventory', perm: 'inventory.stock.view', phase: 4 },
      {
        label: 'FBA Inbound',
        path: '/inventory/inbound',
        perm: 'inventory.inbound.manage',
        phase: 4,
      },
    ],
  },
  {
    key: 'payments',
    label: 'Payments',
    icon: 'bank',
    items: [
      { label: 'Payments', path: '/payments', perm: 'finance.payout.view', phase: 5 },
      {
        label: 'Settlements',
        path: '/payments/settlements',
        perm: 'finance.payout.view',
        phase: 5,
      },
      {
        label: 'Transactions',
        path: '/payments/transactions',
        perm: 'finance.transaction.view',
        phase: 5,
      },
      { label: 'Reconciliation', path: '/payments/reconciliation', perm: 'finance.reconciliation.view', phase: 15 },
      { label: 'Fees & Commission', path: '/payments/fees', perm: 'finance.fee.view', phase: 15 },
      {
        label: 'Invoices & Tax',
        path: '/payments/invoices',
        perm: 'finance.invoice.view',
        phase: 5,
      },
    ],
  },
  {
    key: 'growth',
    label: 'Growth & Ads',
    icon: 'rise',
    items: [
      { label: 'Advertising', path: '/ads', perm: 'ads.campaign.view', phase: 6 },
      { label: 'Flash Sales', path: '/promotions', perm: 'promotions.deal.manage', phase: 6 },
      { label: 'Coupons', path: '/promotions/coupons', perm: 'promotions.coupon.manage', phase: 6 },
    ],
  },
  {
    key: 'performance',
    label: 'Performance',
    icon: 'star',
    items: [
      { label: 'Account Health', path: '/performance', perm: 'performance.health.view', phase: 7 },
      { label: 'Claims', path: '/performance/claims', perm: 'performance.claim.view', phase: 7 },
      {
        label: 'Penalties',
        path: '/performance/penalties',
        perm: 'performance.penalty.view',
        phase: 7,
      },
    ],
  },
  {
    key: 'customer-experience',
    label: 'Customer Experience',
    icon: 'message',
    items: [
      { label: 'Reviews', path: '/customer-experience/reviews', perm: 'customer_experience.review.view', phase: 16 },
      { label: 'Questions', path: '/customer-experience/questions', perm: 'customer_experience.question.view', phase: 16 },
      { label: 'Buyer Messages', path: '/customer-experience/messages', perm: 'customer_experience.message.view', phase: 16 },
    ],
  },
  {
    key: 'analytics',
    label: 'Analytics',
    icon: 'barChart',
    items: [
      { label: 'Overview', path: '/analytics/overview', perm: 'analytics.dashboard.view', phase: 17 },
      { label: 'Products', path: '/analytics/products', perm: 'analytics.dashboard.view', phase: 17 },
      { label: 'Traffic & Ads', path: '/analytics/traffic', perm: 'analytics.dashboard.view', phase: 17 },
      { label: 'Operations', path: '/analytics/operations', perm: 'analytics.dashboard.view', phase: 17 },
      { label: 'Finance', path: '/analytics/finance', perm: 'analytics.dashboard.view', phase: 17 },
      { label: 'Recommendations', path: '/analytics/recommendations', perm: 'analytics.recommendation.view', phase: 17 },
    ],
  },
  {
    key: 'reports',
    label: 'Reports',
    icon: 'barChart',
    items: [{ label: 'Reports', path: '/reports', perm: 'reports.report.view', phase: 8 }],
  },
  {
    key: 'support',
    label: 'Support',
    icon: 'customerService',
    items: [{ label: 'Help & Tickets', path: '/support', perm: 'support.ticket.view', phase: 8 }],
  },
  {
    key: 'settings',
    label: 'Settings',
    icon: 'setting',
    items: [
      {
        label: 'Business Profile',
        path: '/settings/profile',
        perm: 'settings.profile.view',
        phase: 8,
      },
      { label: 'Bank account', path: '/settings/bank', perm: 'settings.bank.manage', phase: 8 },
      { label: 'Warehouses', path: '/settings/warehouses', perm: 'settings.pickup.manage', phase: 13 },
      { label: 'Users & Roles', path: '/settings/users', perm: 'settings.user.view', phase: 8 },
      { label: 'Roles & Permissions', path: '/settings/roles', perm: 'security.role.view', phase: 18 },
      { label: 'Security Centre', path: '/settings/security', perm: 'security.session.view', phase: 18 },
      { label: 'Integrations', path: '/settings/integrations', perm: 'security.webhook.view', phase: 18 },
      { label: 'API Keys', path: '/settings/api-keys', perm: 'security.api_key.view', phase: 18 },
      { label: 'Webhooks', path: '/settings/webhooks', perm: 'security.webhook.view', phase: 18 },
      { label: 'Activity & Audit', path: '/settings/audit', perm: 'security.audit.view', phase: 18 },
      {
        label: 'Notifications',
        path: '/settings/notifications',
        perm: 'settings.notification.manage',
        phase: 8,
      },
    ],
  },
];

export const ALL_NAV_ITEMS = NAV_GROUPS.flatMap((g) =>
  g.items.map((i) => ({ ...i, groupKey: g.key, groupLabel: g.label })),
);

export function navItemForPath(path) {
  return ALL_NAV_ITEMS.find((i) => i.path === path) ?? null;
}
