/**
 * Seller coupons — UI-only mock.
 *
 * No backend yet: in-memory data mimics the API so a seller can create their own
 * discount codes, watch them go live, and pause or end them. Replace with real
 * `api.*` calls later; the `{ data, meta }` shape already matches the panel, and
 * money is integer paise everywhere, formatted only at render.
 */

const now = Date.now();
const days = (n) => new Date(now + n * 86_400_000).toISOString();

export const COUPON_TYPE_LABELS = {
  PERCENT: 'Percentage off',
  FLAT: 'Flat amount off',
  FREE_DELIVERY: 'Free delivery',
};

/** Status is derived from dates, redemptions and whether the seller paused it. */
function deriveStatus(c) {
  if (c.pausedAt) return 'PAUSED';
  if (c.totalRedemptions >= c.totalLimit) return 'EXHAUSTED';
  if (new Date(c.endsAt) <= new Date()) return 'EXPIRED';
  if (new Date(c.startsAt) > new Date()) return 'SCHEDULED';
  return 'ACTIVE';
}

let SEQ = 100;
let COUPONS = [
  {
    id: 'cpn_1', code: 'WELCOME10', name: '10% off your first order', description: 'New-customer welcome offer.',
    type: 'PERCENT', valuePct: 10, valuePaise: null, maxDiscountPaise: 20000, minCartPaise: 49900,
    totalLimit: 1000, perUserLimit: 1, totalRedemptions: 342,
    startsAt: days(-10), endsAt: days(20), pausedAt: null, createdAt: days(-12),
  },
  {
    id: 'cpn_2', code: 'FLAT150', name: '₹150 off orders above ₹999', description: null,
    type: 'FLAT', valuePct: null, valuePaise: 15000, maxDiscountPaise: null, minCartPaise: 99900,
    totalLimit: 500, perUserLimit: 2, totalRedemptions: 500,
    startsAt: days(-30), endsAt: days(10), pausedAt: null, createdAt: days(-31),
  },
  {
    id: 'cpn_3', code: 'FREESHIP', name: 'Free delivery, no minimum', description: 'Weekend shipping treat.',
    type: 'FREE_DELIVERY', valuePct: null, valuePaise: null, maxDiscountPaise: null, minCartPaise: 0,
    totalLimit: 2000, perUserLimit: 3, totalRedemptions: 118,
    startsAt: days(2), endsAt: days(9), pausedAt: null, createdAt: days(-1),
  },
  {
    id: 'cpn_4', code: 'DIWALI25', name: '25% off festive range', description: null,
    type: 'PERCENT', valuePct: 25, valuePaise: null, maxDiscountPaise: 50000, minCartPaise: 149900,
    totalLimit: 800, perUserLimit: 1, totalRedemptions: 640,
    startsAt: days(-40), endsAt: days(-5), pausedAt: null, createdAt: days(-42),
  },
  {
    id: 'cpn_5', code: 'EARLYBIRD', name: 'Flat ₹300 off for early shoppers', description: null,
    type: 'FLAT', valuePct: null, valuePaise: 30000, maxDiscountPaise: null, minCartPaise: 199900,
    totalLimit: 300, perUserLimit: 1, totalRedemptions: 87,
    startsAt: days(-3), endsAt: days(30), pausedAt: days(-1), createdAt: days(-4),
  },
];

const wait = (ms = 220) => new Promise((r) => setTimeout(r, ms));
const withStatus = (c) => ({ ...c, status: deriveStatus(c) });

export const sellerCouponsApi = {
  async list(params = {}) {
    await wait();
    let rows = COUPONS.map(withStatus);
    if (params.q) {
      const n = params.q.toLowerCase();
      rows = rows.filter((r) => r.code.toLowerCase().includes(n) || r.name.toLowerCase().includes(n));
    }
    if (params.status) rows = rows.filter((r) => r.status === params.status);
    rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return { data: rows, meta: { total: rows.length } };
  },

  async create(input) {
    await wait();
    const code = String(input.code).trim().toUpperCase();
    if (COUPONS.some((c) => c.code === code)) {
      throw new Error(`Coupon code "${code}" already exists.`);
    }
    const coupon = {
      id: `cpn_new_${SEQ++}`,
      code,
      name: input.name,
      description: input.description || null,
      type: input.type,
      valuePct: input.type === 'PERCENT' ? input.valuePct : null,
      valuePaise: input.type === 'FLAT' ? input.valuePaise : null,
      maxDiscountPaise: input.type === 'PERCENT' ? (input.maxDiscountPaise ?? null) : null,
      minCartPaise: input.minCartPaise ?? 0,
      totalLimit: input.totalLimit,
      perUserLimit: input.perUserLimit,
      totalRedemptions: 0,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      pausedAt: null,
      createdAt: new Date().toISOString(),
    };
    COUPONS = [coupon, ...COUPONS];
    return { data: withStatus(coupon) };
  },

  async setPaused(id, paused) {
    await wait();
    COUPONS = COUPONS.map((c) =>
      c.id === id ? { ...c, pausedAt: paused ? new Date().toISOString() : null } : c);
    return { data: withStatus(COUPONS.find((c) => c.id === id)) };
  },

  async end(id) {
    await wait();
    COUPONS = COUPONS.map((c) =>
      c.id === id ? { ...c, pausedAt: null, endsAt: new Date().toISOString() } : c);
    return { data: withStatus(COUPONS.find((c) => c.id === id)) };
  },
};

export const sellerCouponKeys = {
  list: (p) => ['seller', 'coupons', 'list', p],
};
