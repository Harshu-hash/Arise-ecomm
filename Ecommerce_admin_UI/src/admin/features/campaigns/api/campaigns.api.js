import { api } from '@core/api/axiosInstance';

/**
 * Promotional campaigns (flash deal / offer / sale) — admin side.
 *
 *   Campaign   — a promo the admin runs.
 *   Submission — a seller's product entry. It only reaches the customer app once the admin APPROVES it.
 */

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

export const campaignsApi = {
  list: (params) => api.get('/campaigns', params),
  get: (id) => api.get(`/campaigns/${id}`),
  submissions: (id, params) => api.get(`/campaigns/${id}/submissions`, params),
  createCampaign: (payload) => api.post('/campaigns', payload),
  updateCampaign: (id, payload) => api.patch(`/campaigns/${id}`, payload),
  // Adds or removes this campaign's own banner from the home screen's flash sale slot; any number of campaigns can hold it at once.
  setHomeFlashSale: (id, enabled) => api.post(`/campaigns/${id}/home-flash-sale`, { enabled }),
  setStatus: (id, status) => api.post(`/campaigns/${id}/status`, { status }),
  // `decision` is 'approve' | 'reject' | 'changes'; one call covers one entry or a whole selection.
  decideSubmissions: (id, submissionIds, decision, reason) =>
    api.post(`/campaigns/${id}/submissions/decision`, { submissionIds, decision, reason }),
};

export const campaignKeys = {
  list: (p) => ['admin', 'campaigns', 'list', p],
  detail: (id) => ['admin', 'campaigns', 'detail', id],
  submissions: (id, p) => ['admin', 'campaigns', 'submissions', id, p],
};

export const campaignHelpers = { typeLabel, sectionLabel };
