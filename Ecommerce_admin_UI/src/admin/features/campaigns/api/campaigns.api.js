/* eslint-disable max-lines -- in-memory seed data + mock API kept together until the backend lands */
/**
 * Promotional Campaigns — admin side (UI-only mock).
 *
 * There is no backend yet: this module keeps an in-memory dataset and mimics a
 * list/detail/mutation API so the screens render and feel real (filtering,
 * paging, approve/reject). Swap these functions for real `api.*` calls when the
 * backend lands — the component contracts (`{ data, meta }`) already match the
 * rest of the panel.
 *
 * Domain recap:
 *   Campaign        — a promo the admin runs (flash deal / offer / sale).
 *   Submission      — a seller's product entry into a campaign. It only reaches
 *                     the customer app once the admin APPROVES it.
 */

const now = Date.now();
const hrs = (n) => new Date(now + n * 3600_000).toISOString();
const days = (n) => new Date(now + n * 86_400_000).toISOString();

/** Where approved products surface in the customer app. */
export const CUSTOMER_SECTIONS = [
  { value: 'FLASH_DEALS_RAIL', label: 'Home · Flash Deals rail' },
  { value: 'OFFERS_PAGE', label: 'Offers page' },
  { value: 'TOP_VALUE_DEALS', label: 'Home · Top Value Deals' },
  { value: 'SALE_LANDING', label: 'Dedicated sale landing page' },
  { value: 'CATEGORY_SPOTLIGHT', label: 'Category spotlight banner' },
];

export const CAMPAIGN_TYPES = [
  { value: 'FLASH_DEAL', label: 'Flash deal', hint: 'Short, time-boxed drop' },
  { value: 'OFFER', label: 'Offer', hint: 'Everyday discounted rail' },
  { value: 'SALE_EVENT', label: 'Sale event', hint: 'Multi-day festive sale' },
  { value: 'CLEARANCE', label: 'Clearance', hint: 'Stock liquidation' },
];

const typeLabel = (v) => CAMPAIGN_TYPES.find((t) => t.value === v)?.label ?? v;
const sectionLabel = (v) => CUSTOMER_SECTIONS.find((s) => s.value === v)?.label ?? v;

let CAMPAIGNS = [
  {
    id: 'cmp_1001',
    name: 'Big Billion Days 2026',
    type: 'SALE_EVENT',
    status: 'OPEN',
    customerSection: 'SALE_LANDING',
    tagline: 'The biggest sale of the year',
    minDiscountPct: 40,
    startsAt: days(9),
    endsAt: days(14),
    submissionDeadline: days(6),
    createdAt: days(-5),
    sellersJoined: 42,
    pendingCount: 18,
    approvedCount: 126,
    rejectedCount: 7,
  },
  {
    id: 'cmp_1002',
    name: 'Electronics Flash Deal',
    type: 'FLASH_DEAL',
    status: 'ACTIVE',
    customerSection: 'FLASH_DEALS_RAIL',
    tagline: 'Ends tonight — grab it fast',
    minDiscountPct: 30,
    startsAt: hrs(-2),
    endsAt: hrs(6),
    submissionDeadline: hrs(-6),
    createdAt: days(-3),
    sellersJoined: 16,
    pendingCount: 3,
    approvedCount: 54,
    rejectedCount: 2,
  },
  {
    id: 'cmp_1003',
    name: 'Monsoon Fashion Offers',
    type: 'OFFER',
    status: 'OPEN',
    customerSection: 'OFFERS_PAGE',
    tagline: 'Rain-ready styles under ₹999',
    minDiscountPct: 25,
    startsAt: days(2),
    endsAt: days(20),
    submissionDeadline: days(1),
    createdAt: days(-4),
    sellersJoined: 23,
    pendingCount: 11,
    approvedCount: 38,
    rejectedCount: 1,
  },
  {
    id: 'cmp_1004',
    name: 'Home & Kitchen Clearance',
    type: 'CLEARANCE',
    status: 'SCHEDULED',
    customerSection: 'TOP_VALUE_DEALS',
    tagline: 'Last pieces, lowest prices',
    minDiscountPct: 50,
    startsAt: days(5),
    endsAt: days(12),
    submissionDeadline: days(3),
    createdAt: days(-1),
    sellersJoined: 4,
    pendingCount: 6,
    approvedCount: 0,
    rejectedCount: 0,
  },
  {
    id: 'cmp_1005',
    name: 'Independence Day Sale',
    type: 'SALE_EVENT',
    status: 'ENDED',
    customerSection: 'SALE_LANDING',
    tagline: 'Freedom to save big',
    minDiscountPct: 35,
    startsAt: days(-30),
    endsAt: days(-25),
    submissionDeadline: days(-33),
    createdAt: days(-40),
    sellersJoined: 58,
    pendingCount: 0,
    approvedCount: 214,
    rejectedCount: 19,
  },
  {
    id: 'cmp_1006',
    name: 'Beauty Bonanza',
    type: 'OFFER',
    status: 'DRAFT',
    customerSection: 'CATEGORY_SPOTLIGHT',
    tagline: '',
    minDiscountPct: 20,
    startsAt: days(15),
    endsAt: days(22),
    submissionDeadline: days(12),
    createdAt: hrs(-4),
    sellersJoined: 0,
    pendingCount: 0,
    approvedCount: 0,
    rejectedCount: 0,
  },
];

const BRANDS = ['Nova', 'Aura', 'Peak', 'Zenith', 'Urban', 'Craft', 'Bliss', 'Motion'];
const SELLERS = [
  { id: 'sl_01', name: 'Trendline Retail' },
  { id: 'sl_02', name: 'MegaMart Wholesale' },
  { id: 'sl_03', name: 'Kanha Enterprises' },
  { id: 'sl_04', name: 'Blue Ocean Traders' },
  { id: 'sl_05', name: 'Shreeji Distributors' },
];
const PRODUCTS = [
  'Wireless Earbuds Pro', 'Cotton Kurta Set', 'Non-stick Fry Pan', 'LED Smart Bulb (Pack of 4)',
  'Running Shoes', 'Stainless Steel Bottle', 'Bluetooth Speaker', 'Analog Wrist Watch',
  'Ceramic Dinner Set', 'Yoga Mat 6mm', 'Face Serum 30ml', 'Backpack 30L',
];

let SEQ = 1;
function makeSubmission(campaignId, status, i) {
  const seller = SELLERS[i % SELLERS.length];
  const title = PRODUCTS[(i * 3) % PRODUCTS.length];
  const brand = BRANDS[i % BRANDS.length];
  const mrpPaise = (499 + ((i * 137) % 40) * 50) * 100;
  const discountPct = 25 + ((i * 7) % 45);
  const dealPricePaise = Math.round((mrpPaise * (100 - discountPct)) / 100 / 100) * 100;
  return {
    id: `sub_${campaignId}_${SEQ++}`,
    campaignId,
    sellerId: seller.id,
    sellerName: seller.name,
    productId: `prd_${1000 + i}`,
    productTitle: `${brand} ${title}`,
    brand,
    imageUrl: null,
    mrpPaise,
    dealPricePaise,
    discountPct,
    stockCommitted: 20 + ((i * 11) % 180),
    status,
    submittedAt: hrs(-(i + 1) * 5),
    reviewedAt: status === 'PENDING' || status === 'DRAFT' ? null : hrs(-(i + 1) * 2),
    reviewer: status === 'PENDING' || status === 'DRAFT' ? null : 'Priya Nair',
    rejectionReason:
      status === 'REJECTED'
        ? 'Discount below the campaign minimum'
        : status === 'NEEDS_CHANGES'
          ? 'Main image does not meet the white-background rule'
          : null,
  };
}

let SUBMISSIONS = [];
(function seedSubmissions() {
  const plan = {
    cmp_1001: ['PENDING', 'PENDING', 'PENDING', 'APPROVED', 'APPROVED', 'APPROVED', 'APPROVED', 'REJECTED', 'NEEDS_CHANGES'],
    cmp_1002: ['PENDING', 'PENDING', 'PENDING', 'APPROVED', 'APPROVED', 'REJECTED'],
    cmp_1003: ['PENDING', 'PENDING', 'APPROVED', 'APPROVED', 'NEEDS_CHANGES'],
    cmp_1004: ['PENDING', 'PENDING', 'PENDING'],
    cmp_1005: ['APPROVED', 'APPROVED', 'APPROVED', 'REJECTED'],
  };
  Object.entries(plan).forEach(([cid, statuses]) => {
    statuses.forEach((s, i) => SUBMISSIONS.push(makeSubmission(cid, s, i + Number(cid.slice(-1)))));
  });
})();

/* ------------------------------------------------------------------ */
/* Fake network helpers                                                */
/* ------------------------------------------------------------------ */

const wait = (ms = 220) => new Promise((r) => setTimeout(r, ms));

function paginate(list, params = {}) {
  const page = Number(params.page ?? 1);
  const pageSize = Number(params.pageSize ?? 25);
  const start = (page - 1) * pageSize;
  return { data: list.slice(start, start + pageSize), total: list.length, page, pageSize };
}

function facetCounts(list, field) {
  return list.reduce((acc, row) => {
    acc[row[field]] = (acc[row[field]] ?? 0) + 1;
    return acc;
  }, {});
}

function matchText(row, q, fields) {
  if (!q) return true;
  const needle = String(q).toLowerCase();
  return fields.some((f) => String(row[f] ?? '').toLowerCase().includes(needle));
}

export const campaignsApi = {
  async list(params = {}) {
    await wait();
    let rows = [...CAMPAIGNS];
    rows = rows.filter((r) => matchText(r, params.q, ['name', 'tagline']));
    if (params.type) {
      const types = String(params.type).split(',');
      rows = rows.filter((r) => types.includes(r.type));
    }
    if (params.status && params.status !== 'all') {
      const statuses = String(params.status).split(',');
      rows = rows.filter((r) => statuses.includes(r.status));
    }
    rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const facets = { status: facetCounts(CAMPAIGNS, 'status') };
    const { data, total, page, pageSize } = paginate(rows, params);
    return { data, meta: { total, page, pageSize, facets } };
  },

  async get(id) {
    await wait();
    const campaign = CAMPAIGNS.find((c) => c.id === id);
    if (!campaign) throw new Error('Campaign not found');
    return { data: campaign };
  },

  async submissions(campaignId, params = {}) {
    await wait();
    let rows = SUBMISSIONS.filter((s) => s.campaignId === campaignId);
    const all = [...rows];
    rows = rows.filter((r) => matchText(r, params.q, ['productTitle', 'sellerName', 'brand']));
    if (params.status && params.status !== 'all') {
      const statuses = String(params.status).split(',');
      rows = rows.filter((r) => statuses.includes(r.status));
    }
    rows.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
    const facets = { status: facetCounts(all, 'status') };
    const { data, total, page, pageSize } = paginate(rows, params);
    return { data, meta: { total, page, pageSize, facets } };
  },

  async createCampaign(payload) {
    await wait();
    const campaign = {
      id: `cmp_${Math.floor(Math.random() * 9000 + 1000)}`,
      status: 'DRAFT',
      createdAt: new Date().toISOString(),
      sellersJoined: 0,
      pendingCount: 0,
      approvedCount: 0,
      rejectedCount: 0,
      ...payload,
    };
    CAMPAIGNS = [campaign, ...CAMPAIGNS];
    return { data: campaign };
  },

  async updateCampaign(id, payload) {
    await wait();
    CAMPAIGNS = CAMPAIGNS.map((c) => (c.id === id ? { ...c, ...payload } : c));
    return { data: CAMPAIGNS.find((c) => c.id === id) };
  },

  async setStatus(id, status) {
    await wait();
    CAMPAIGNS = CAMPAIGNS.map((c) => (c.id === id ? { ...c, status } : c));
    return { data: CAMPAIGNS.find((c) => c.id === id) };
  },

  async decideSubmission(submissionId, decision, reason) {
    await wait();
    const status =
      decision === 'approve' ? 'APPROVED' : decision === 'reject' ? 'REJECTED' : 'NEEDS_CHANGES';
    let touched;
    SUBMISSIONS = SUBMISSIONS.map((s) => {
      if (s.id !== submissionId) return s;
      touched = {
        ...s,
        status,
        reviewedAt: new Date().toISOString(),
        reviewer: 'You',
        rejectionReason: decision === 'approve' ? null : reason ?? null,
      };
      return touched;
    });
    // Keep the parent campaign's counters honest.
    if (touched) recountCampaign(touched.campaignId);
    return { data: touched };
  },
};

function recountCampaign(campaignId) {
  const rows = SUBMISSIONS.filter((s) => s.campaignId === campaignId);
  const by = (st) => rows.filter((r) => r.status === st).length;
  CAMPAIGNS = CAMPAIGNS.map((c) =>
    c.id === campaignId
      ? {
          ...c,
          pendingCount: by('PENDING'),
          approvedCount: by('APPROVED'),
          rejectedCount: by('REJECTED'),
        }
      : c,
  );
}

export const campaignKeys = {
  list: (p) => ['admin', 'campaigns', 'list', p],
  detail: (id) => ['admin', 'campaigns', 'detail', id],
  submissions: (id, p) => ['admin', 'campaigns', 'submissions', id, p],
};

export const campaignHelpers = { typeLabel, sectionLabel };
