/**
 * Ported verbatim from the admin console's src/shared/core/rbac/roleTemplates.js so the
 * backend seeds the identical 15 roles the frontend's role editor already describes.
 * Keep the two in sync if the source changes.
 */
import { ALL_PERMISSIONS, expandImplied } from './permissionCatalog.js';

/**
 * Matches a dotted permission key against a dotted glob pattern. A `*` stands for one
 * whole segment, except as the final segment where it absorbs everything left.
 */
function matchesPattern(key, pattern) {
  const pat = pattern.split('.');
  const seg = key.split('.');
  for (let i = 0; i < pat.length; i += 1) {
    const isLast = i === pat.length - 1;
    if (pat[i] === '*') {
      if (isLast) return seg.length > i;
      if (i >= seg.length) return false;
      continue;
    }
    if (seg[i] !== pat[i]) return false;
    if (isLast) return seg.length === pat.length;
  }
  return seg.length === pat.length;
}

/**
 * Resolves glob patterns against the permission catalog. A leading `-` removes matches
 * an earlier pattern added, so a role can be "this module, except these few actions".
 */
export function resolvePatterns(patterns) {
  const set = new Set();
  for (const raw of patterns) {
    const remove = raw.startsWith('-');
    const pattern = remove ? raw.slice(1) : raw;
    for (const p of ALL_PERMISSIONS) {
      if (!matchesPattern(p.key, pattern)) continue;
      if (remove) set.delete(p.key);
      else set.add(p.key);
    }
  }
  return expandImplied(Array.from(set));
}

export const ROLE_TEMPLATES = [
  { key: 'super_admin', name: 'Super Admin', description: 'Unrestricted access, including roles, settings and all approvals.', system: true, patterns: ['*'] },
  {
    key: 'operations_manager', name: 'Operations Manager',
    description: 'Day-to-day marketplace operations across orders, catalog, sellers and logistics.', system: true,
    patterns: [
      'dashboard.*', 'orders.*', 'catalog.*', '-catalog.rules.edit', 'sellers.*',
      '-sellers.seller.blacklist', '-sellers.bank.view_full', '-sellers.seller.change_plan',
      'customers.customer.*', '-customers.customer.block', 'logistics.*', '-logistics.courier.edit_rates',
      '-logistics.rules.edit', 'warehouse.*.view', 'warehouse.inventory.export', 'reviews.*',
      'reports.*.view', 'reports.library.export', 'reports.export.*', 'reports.schedule.*',
      'admin.audit.view', 'admin.approval.view', 'admin.approval.decide',
    ],
  },
  {
    key: 'catalog_manager', name: 'Catalog Manager',
    description: 'Owns the full catalog: taxonomy, attributes, brands, listings and QC.', system: true,
    patterns: [
      'dashboard.dashboard.view', 'dashboard.action_center.view', 'catalog.*', 'reviews.*', 'cms.search.*',
      'reports.operations.view', 'reports.library.*', 'reports.export.*', 'admin.audit.view',
    ],
  },
  {
    key: 'category_manager', name: 'Category Manager',
    description: 'Listing QC and catalog work for assigned categories only.', system: true, scopedBy: ['categories'],
    patterns: [
      'dashboard.dashboard.view', 'dashboard.action_center.view', 'catalog.product.*', '-catalog.product.block',
      '-catalog.product.bulk_edit', 'catalog.category.view', 'catalog.attribute.view', 'catalog.brand.view',
      'catalog.sizechart.*', 'catalog.import.*', 'reviews.review.*', 'reports.operations.view',
    ],
  },
  {
    key: 'seller_onboarding', name: 'Seller Onboarding Executive',
    description: 'Reviews seller applications and KYC documents.', system: true,
    patterns: [
      'dashboard.dashboard.view', 'dashboard.action_center.view', 'sellers.application.*', 'sellers.kyc.*',
      'sellers.brandapproval.*', 'sellers.seller.view', 'sellers.seller.note', 'catalog.brand.view', 'admin.audit.view',
    ],
  },
  {
    key: 'seller_account_manager', name: 'Seller Account Manager',
    description: 'Manages performance and growth for an assigned portfolio of sellers.', system: true, scopedBy: ['sellers'],
    patterns: [
      'dashboard.dashboard.view', 'sellers.seller.view', 'sellers.seller.edit', 'sellers.seller.note',
      'sellers.seller.hold', 'sellers.seller.change_tier', 'sellers.seller.impersonate_view',
      'sellers.penalty.view', 'sellers.claim.view', 'catalog.product.view', 'orders.order.view',
      'finance.payout.view', 'reports.operations.view', 'marketing.flashsale.view',
    ],
  },
  {
    key: 'finance_executive', name: 'Finance Executive',
    description: 'Prepares refunds, payouts and reconciliation. Cannot approve its own work.', system: true,
    scopedBy: ['refundLimit', 'walletAdjustLimit'],
    patterns: [
      'dashboard.dashboard.view', 'dashboard.finance_widgets.view', 'finance.*', '-finance.payout.approve',
      '-finance.payout.release', '-finance.commission.edit', '-finance.tax.edit_rates', 'wallet.*',
      '-wallet.giftcard.generate', 'orders.order.view', 'sellers.seller.view', 'reports.finance.view',
      'reports.library.*', 'reports.export.*',
    ],
  },
  {
    key: 'finance_approver', name: 'Finance Approver',
    description: 'Approves payouts, refunds above limits and fee changes raised by others.', system: true,
    patterns: [
      'dashboard.dashboard.view', 'dashboard.finance_widgets.view', 'finance.*.view', 'finance.payout.approve',
      'finance.payout.release', 'finance.payout.hold', 'finance.payout.adjust', 'finance.refund.issue',
      'wallet.adjust.create', 'wallet.giftcard.generate', 'finance.commission.*', 'finance.tax.*',
      'admin.approval.*', 'admin.audit.*', 'reports.finance.view',
    ],
  },
  {
    key: 'support_agent', name: 'Customer Support Agent',
    description: 'Handles tickets and chats, with order actions within set limits.', system: true,
    scopedBy: ['queues', 'refundLimit'],
    patterns: [
      'dashboard.dashboard.view', 'support.ticket.*', '-support.ticket.export', 'support.chat.handle',
      'support.macro.view', 'orders.order.view', 'orders.order.note', 'orders.order.edit_address',
      'orders.item.cancel', 'orders.item.return_initiate', 'orders.return.view', 'orders.return.approve',
      'orders.return.reschedule', 'customers.customer.view', 'customers.pii.view', 'finance.refund.view',
      'finance.refund.issue', 'wallet.account.view', 'wallet.ledger.view', 'logistics.shipment.view',
      'logistics.ndr.action', 'catalog.product.view',
    ],
  },
  {
    key: 'support_lead', name: 'Support Lead',
    description: 'Runs the support floor: queues, routing, SLAs, QA and escalations.', system: true,
    patterns: [
      'dashboard.dashboard.view', 'dashboard.action_center.view', 'support.*', 'orders.*', '-orders.order.export',
      'customers.customer.*', 'customers.pii.view', 'customers.privacy.*', 'finance.refund.view',
      'finance.refund.issue', 'finance.refund.retry', 'wallet.*.view', 'wallet.adjust.create',
      'logistics.*.view', 'logistics.ndr.action', 'reviews.*', 'reports.*.view', 'reports.export.*',
    ],
  },
  {
    key: 'marketing_manager', name: 'Marketing Manager',
    description: 'Owns promotions, campaigns, segments and app content.', system: true,
    patterns: [
      'dashboard.dashboard.view', 'marketing.*', 'cms.*', 'notifications.*', 'wallet.cashback.*',
      'wallet.giftcard.*', '-wallet.giftcard.generate', 'catalog.product.view', 'catalog.category.view',
      'catalog.brand.view', 'customers.customer.view', 'reports.sales.view', 'reports.library.*', 'reports.export.*',
    ],
  },
  {
    key: 'warehouse_manager', name: 'Warehouse Manager',
    description: 'Runs assigned fulfilment centres: inbound, inventory and dispatch.', system: true, scopedBy: ['warehouses'],
    patterns: [
      'dashboard.dashboard.view', 'dashboard.action_center.view', 'warehouse.*', '-warehouse.warehouse.create',
      '-warehouse.warehouse.delete', 'logistics.shipment.view', 'logistics.shipment.print', 'logistics.pickup.*',
      'orders.order.view', 'catalog.product.view', 'reports.operations.view',
    ],
  },
  {
    key: 'logistics_manager', name: 'Logistics Manager',
    description: 'Owns couriers, serviceability, allocation rules, NDR and RTO.', system: true,
    patterns: [
      'dashboard.dashboard.view', 'dashboard.action_center.view', 'logistics.*', 'warehouse.warehouse.view',
      'warehouse.inventory.view', 'orders.order.view', 'finance.cod.*', 'reports.operations.view',
      'reports.library.*', 'reports.export.*',
    ],
  },
  {
    key: 'ads_manager', name: 'Ads Manager',
    description: 'Runs the sponsored ads business: review, placements and billing.', system: true,
    patterns: ['dashboard.dashboard.view', 'ads.*', 'catalog.product.view', 'sellers.seller.view', 'reports.sales.view', 'reports.export.*'],
  },
  {
    key: 'auditor', name: 'Auditor',
    description: 'Read-only across the platform, with no access to personal data.', system: true,
    patterns: ['*.*.view', '-customers.pii.view', '-sellers.bank.view_full', 'admin.audit.export'],
  },
];

/** Materialises a template into a role record with concrete permission keys. */
export function buildRoleFromTemplate(template) {
  const unrestricted = template.patterns.length === 1 && template.patterns[0] === '*';
  return {
    key: template.key,
    name: template.name,
    description: template.description,
    system: Boolean(template.system),
    scopedBy: template.scopedBy ?? [],
    permissions: unrestricted ? ['*'] : resolvePatterns(template.patterns),
  };
}

export const SEEDED_ROLES = ROLE_TEMPLATES.map(buildRoleFromTemplate);
