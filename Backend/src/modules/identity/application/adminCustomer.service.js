import mongoose from 'mongoose';
import { recordAudit } from '../../../infrastructure/audit/audit.js';
import { ROLES } from '../../../shared/constants/roles.js';
import { ConflictError, NotFoundError } from '../../../shared/errors/AppError.js';
import { User } from '../infrastructure/persistence/user.model.js';
import { revokeAllSessions } from './session.service.js';

// The panel's customer vocabulary over the account status: SUSPENDED = BLOCKED, DEACTIVATED = DELETED.
const TO_PANEL = { ACTIVE: 'ACTIVE', SUSPENDED: 'BLOCKED', DEACTIVATED: 'DELETED' };
const TO_DB = { ACTIVE: 'ACTIVE', BLOCKED: 'SUSPENDED', DELETED: 'DEACTIVATED' };
const LIST_FIELDS = 'name email phone status createdAt lastLoginAt';
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const range = (gte, lte) => ({ ...(gte ? { $gte: new Date(gte) } : {}), ...(lte ? { $lte: new Date(lte) } : {}) });

function serializeCustomer(user) {
  return {
    id: String(user._id),
    name: user.name ?? 'Customer',
    email: user.email ?? null,
    phone: user.phone ?? null,
    status: TO_PANEL[user.status],
    joinedAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
}

function baseFilter(query) {
  const joined = range(query['joinedAt[gte]'], query['joinedAt[lte]']);
  return {
    role: ROLES.CUSTOMER,
    status: { $in: Object.keys(TO_PANEL) }, // INVITED / UNDER_REVIEW are not customer states
    ...(query.q
      ? { $or: ['name', 'email', 'phone'].map((field) => ({ [field]: new RegExp(escapeRegex(query.q), 'i') })) }
      : {}),
    ...(Object.keys(joined).length ? { createdAt: joined } : {}),
  };
}

/** `customerIds`: the customers an admin is limited to (those who bought from their sellers), or null for all. */
export async function listCustomers(query, { customerIds = null } = {}) {
  const match = { ...baseFilter(query), ...(customerIds ? { _id: { $in: customerIds.map((id) => new mongoose.Types.ObjectId(id)) } } : {}) };
  const filter = query.status.length ? { ...match, status: { $in: query.status.map((s) => TO_DB[s]) } } : match;
  const [rows, total, facets] = await Promise.all([
    User.find(filter, LIST_FIELDS)
      .sort({ [query.sortField]: query.sortDirection, _id: 1 })
      .skip((query.page - 1) * query.pageSize)
      .limit(query.pageSize)
      .lean(),
    User.countDocuments(filter),
    // Tab badges ignore the status filter so each tab keeps its own count.
    User.aggregate([{ $match: match }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);
  return {
    data: rows.map(serializeCustomer),
    meta: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      facets: { status: Object.fromEntries(facets.map((row) => [TO_PANEL[row._id], row.count])) },
    },
  };
}

// Orders, returns, wallet and risk live in modules that do not exist yet, so the detail view serves
// honest zeros / empty lists for them rather than invented numbers.
// shortcut: replace these placeholders with real reads when the order/wallet modules land.
export async function getCustomer(id, permissions) {
  const user = await User.findOne({ _id: id, role: ROLES.CUSTOMER }, LIST_FIELDS).lean();
  if (!user || !TO_PANEL[user.status]) throw new NotFoundError('That customer no longer exists.');
  const canBlock = permissions.includes('*') || permissions.includes('customers.customer.block');
  return {
    data: {
      ...serializeCustomer(user),
      riskLevel: 'LOW', riskScore: 0, openFlags: 0, codDisabled: false, walletBalancePaise: 0,
      rtoPct: 0, returnPct: 0, segments: [], platform: null, languagePreference: 'en',
    },
    meta: {
      allowedActions: canBlock && user.status !== 'DEACTIVATED' ? [user.status === 'SUSPENDED' ? 'UNBLOCK' : 'BLOCK'] : [],
      addresses: [], devices: [], linkedAccounts: [], riskFlags: [], recentOrders: [], returns: [], refunds: [],
      stats: { orders: 0, gmvPaise: 0, aovPaise: 0, cancelled: 0, returns: 0, refundedPaise: 0 },
    },
  };
}

// Guarded on the expected current status so a double click cannot apply twice.
export async function setCustomerBlocked(id, blocked, reason, actor) {
  const [from, to] = blocked ? ['ACTIVE', 'SUSPENDED'] : ['SUSPENDED', 'ACTIVE'];
  const updated = await User.findOneAndUpdate(
    { _id: id, role: ROLES.CUSTOMER, status: from },
    { $set: { status: to } },
    { new: true, projection: LIST_FIELDS },
  ).lean();
  if (!updated) {
    if (!(await User.exists({ _id: id, role: ROLES.CUSTOMER }))) throw new NotFoundError('That customer no longer exists.');
    throw new ConflictError('ILLEGAL_TRANSITION', blocked ? 'Only active customers can be blocked.' : 'That customer is not blocked.');
  }
  if (blocked) await revokeAllSessions(id);
  await recordAudit({
    action: blocked ? 'customers.customer.block' : 'customers.customer.unblock',
    subjectType: 'customer',
    subjectId: id,
    before: { status: TO_PANEL[from] },
    after: { status: TO_PANEL[to] },
    reason,
    actor,
  });
  return serializeCustomer(updated);
}
