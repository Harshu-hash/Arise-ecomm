/**
 * Promotional Campaigns — seller side (UI-only mock).
 *
 * No backend yet: in-memory data mimics the API so the seller can browse the
 * campaigns the admin is running, nominate their own listings into one, and
 * watch each entry move from PENDING → APPROVED (live for customers) or get
 * sent back. Replace these with real `api.*` calls later; the `{ data, meta }`
 * shape already matches the rest of the panel.
 */

const now = Date.now();
const hrs = (n) => new Date(now + n * 3600_000).toISOString();
const days = (n) => new Date(now + n * 86_400_000).toISOString();

export const CUSTOMER_SECTION_LABELS = {
  FLASH_DEALS_RAIL: 'Home · Flash Deals rail',
  OFFERS_PAGE: 'Offers page',
  TOP_VALUE_DEALS: 'Home · Top Value Deals',
  SALE_LANDING: 'Dedicated sale landing page',
  CATEGORY_SPOTLIGHT: 'Category spotlight banner',
};

export const CAMPAIGN_TYPE_LABELS = {
  FLASH_DEAL: 'Flash deal',
  OFFER: 'Offer',
  SALE_EVENT: 'Sale event',
  CLEARANCE: 'Clearance',
};

/** Campaigns the admin has published for sellers to join. */
let CAMPAIGNS = [
  {
    id: 'cmp_1001',
    name: 'Big Billion Days 2026',
    type: 'SALE_EVENT',
    status: 'OPEN',
    customerSection: 'SALE_LANDING',
    tagline: 'The biggest sale of the year',
    minDiscountPct: 40,
    maxUnitsPerCustomer: 3,
    startsAt: days(9),
    endsAt: days(14),
    submissionDeadline: days(6),
  },
  {
    id: 'cmp_1002',
    name: 'Electronics Flash Deal',
    type: 'FLASH_DEAL',
    status: 'ACTIVE',
    customerSection: 'FLASH_DEALS_RAIL',
    tagline: 'Ends tonight — grab it fast',
    minDiscountPct: 30,
    maxUnitsPerCustomer: 2,
    startsAt: hrs(-2),
    endsAt: hrs(6),
    submissionDeadline: hrs(-6),
  },
  {
    id: 'cmp_1003',
    name: 'Monsoon Fashion Offers',
    type: 'OFFER',
    status: 'OPEN',
    customerSection: 'OFFERS_PAGE',
    tagline: 'Rain-ready styles under ₹999',
    minDiscountPct: 25,
    maxUnitsPerCustomer: 5,
    startsAt: days(2),
    endsAt: days(20),
    submissionDeadline: days(1),
  },
  {
    id: 'cmp_1004',
    name: 'Home & Kitchen Clearance',
    type: 'CLEARANCE',
    status: 'SCHEDULED',
    customerSection: 'TOP_VALUE_DEALS',
    tagline: 'Last pieces, lowest prices',
    minDiscountPct: 50,
    maxUnitsPerCustomer: 10,
    startsAt: days(5),
    endsAt: days(12),
    submissionDeadline: days(3),
  },
];

/** The signed-in seller's own listings available to nominate. */
export const MY_LISTINGS = [
  { id: 'lst_01', title: 'Nova Wireless Earbuds Pro', brand: 'Nova', sku: 'NOV-EB-01', mrpPaise: 299900, sellingPricePaise: 219900, stock: 240 },
  { id: 'lst_02', title: 'Aura Cotton Kurta Set', brand: 'Aura', sku: 'AUR-KT-07', mrpPaise: 189900, sellingPricePaise: 149900, stock: 120 },
  { id: 'lst_03', title: 'Peak Non-stick Fry Pan', brand: 'Peak', sku: 'PK-FP-24', mrpPaise: 149900, sellingPricePaise: 119900, stock: 85 },
  { id: 'lst_04', title: 'Zenith LED Smart Bulb (Pack of 4)', brand: 'Zenith', sku: 'ZN-BL-04', mrpPaise: 99900, sellingPricePaise: 74900, stock: 500 },
  { id: 'lst_05', title: 'Urban Running Shoes', brand: 'Urban', sku: 'URB-SH-11', mrpPaise: 349900, sellingPricePaise: 259900, stock: 60 },
  { id: 'lst_06', title: 'Bliss Face Serum 30ml', brand: 'Bliss', sku: 'BL-SR-30', mrpPaise: 129900, sellingPricePaise: 99900, stock: 300 },
  { id: 'lst_07', title: 'Motion Bluetooth Speaker', brand: 'Motion', sku: 'MO-SP-02', mrpPaise: 249900, sellingPricePaise: 189900, stock: 150 },
];

let SEQ = 1;
/** The seller's own entries, keyed by campaign. */
let SUBMISSIONS = [
  {
    id: 'msub_1', campaignId: 'cmp_1002', listingId: 'lst_01', productTitle: 'Nova Wireless Earbuds Pro', brand: 'Nova',
    mrpPaise: 299900, dealPricePaise: 199900, discountPct: 33, stockCommitted: 120,
    status: 'APPROVED', submittedAt: hrs(-30), reviewedAt: hrs(-26), feedback: null,
  },
  {
    id: 'msub_2', campaignId: 'cmp_1002', listingId: 'lst_07', productTitle: 'Motion Bluetooth Speaker', brand: 'Motion',
    mrpPaise: 249900, dealPricePaise: 189900, discountPct: 24, stockCommitted: 60,
    status: 'REJECTED', submittedAt: hrs(-28), reviewedAt: hrs(-24), feedback: 'Discount below the 30% campaign minimum.',
  },
  {
    id: 'msub_3', campaignId: 'cmp_1001', listingId: 'lst_05', productTitle: 'Urban Running Shoes', brand: 'Urban',
    mrpPaise: 349900, dealPricePaise: 199900, discountPct: 43, stockCommitted: 40,
    status: 'PENDING', submittedAt: hrs(-10), reviewedAt: null, feedback: null,
  },
  {
    id: 'msub_4', campaignId: 'cmp_1003', listingId: 'lst_02', productTitle: 'Aura Cotton Kurta Set', brand: 'Aura',
    mrpPaise: 189900, dealPricePaise: 139900, discountPct: 26, stockCommitted: 80,
    status: 'NEEDS_CHANGES', submittedAt: hrs(-18), reviewedAt: hrs(-12), feedback: 'Please upload a white-background main image.',
  },
];

const wait = (ms = 220) => new Promise((r) => setTimeout(r, ms));

function paginate(list, params = {}) {
  const page = Number(params.page ?? 1);
  const pageSize = Number(params.pageSize ?? 25);
  const start = (page - 1) * pageSize;
  return { data: list.slice(start, start + pageSize), total: list.length, page, pageSize };
}

const countFor = (campaignId) => SUBMISSIONS.filter((s) => s.campaignId === campaignId).length;
const liveFor = (campaignId) =>
  SUBMISSIONS.filter((s) => s.campaignId === campaignId && s.status === 'APPROVED').length;

export const sellerCampaignsApi = {
  async list(params = {}) {
    await wait();
    let rows = CAMPAIGNS.map((c) => ({
      ...c,
      myProducts: countFor(c.id),
      myLiveProducts: liveFor(c.id),
    }));
    if (params.q) {
      const n = params.q.toLowerCase();
      rows = rows.filter((r) => r.name.toLowerCase().includes(n));
    }
    if (params.type) {
      const types = String(params.type).split(',');
      rows = rows.filter((r) => types.includes(r.type));
    }
    if (params.tab === 'joined') rows = rows.filter((r) => r.myProducts > 0);
    if (params.tab === 'open') rows = rows.filter((r) => r.status === 'OPEN');
    rows.sort((a, b) => new Date(a.submissionDeadline) - new Date(b.submissionDeadline));
    return { data: rows, meta: { total: rows.length } };
  },

  async get(id) {
    await wait();
    const c = CAMPAIGNS.find((x) => x.id === id);
    if (!c) throw new Error('Campaign not found');
    return { data: { ...c, myProducts: countFor(id), myLiveProducts: liveFor(id) } };
  },

  async mySubmissions(campaignId, params = {}) {
    await wait();
    const rows = SUBMISSIONS.filter((s) => s.campaignId === campaignId);
    const { data, total, page, pageSize } = paginate(rows, params);
    return { data, meta: { total, page, pageSize } };
  },

  /** Listings not yet nominated into this campaign. */
  async eligibleListings(campaignId) {
    await wait();
    const taken = new Set(
      SUBMISSIONS.filter((s) => s.campaignId === campaignId && s.status !== 'WITHDRAWN' && s.status !== 'REJECTED')
        .map((s) => s.listingId),
    );
    return { data: MY_LISTINGS.filter((l) => !taken.has(l.id)) };
  },

  async submitProducts(campaignId, entries) {
    await wait();
    const created = entries.map((e) => {
      const listing = MY_LISTINGS.find((l) => l.id === e.listingId);
      const discountPct = Math.round(((listing.mrpPaise - e.dealPricePaise) / listing.mrpPaise) * 100);
      return {
        id: `msub_new_${SEQ++}`,
        campaignId,
        listingId: e.listingId,
        productTitle: listing.title,
        brand: listing.brand,
        mrpPaise: listing.mrpPaise,
        dealPricePaise: e.dealPricePaise,
        discountPct,
        stockCommitted: e.stockCommitted,
        status: 'PENDING',
        submittedAt: new Date().toISOString(),
        reviewedAt: null,
        feedback: null,
      };
    });
    SUBMISSIONS = [...created, ...SUBMISSIONS];
    return { data: created };
  },

  async withdraw(submissionId) {
    await wait();
    SUBMISSIONS = SUBMISSIONS.map((s) =>
      s.id === submissionId ? { ...s, status: 'WITHDRAWN' } : s);
    return { data: { ok: true } };
  },
};

export const sellerCampaignKeys = {
  list: (p) => ['seller', 'campaigns', 'list', p],
  detail: (id) => ['seller', 'campaigns', 'detail', id],
  submissions: (id, p) => ['seller', 'campaigns', 'submissions', id, p],
  eligible: (id) => ['seller', 'campaigns', 'eligible', id],
};
