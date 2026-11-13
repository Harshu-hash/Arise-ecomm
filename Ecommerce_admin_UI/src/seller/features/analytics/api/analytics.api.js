import { api } from '@core/api/axiosInstance';

/**
 * Seller analytics. The backend scopes every view to the signed-in seller and
 * accepts an explicit {from,to} window plus optional category/brand/sku/
 * warehouse/fulfilment filters.
 */
export const analyticsApi = {
  filters: () => api.get('/analytics/filters').then((r) => r.data),
  view: (view, params) => api.get(`/analytics/${view}`, params).then((r) => r.data),
  recommendations: () => api.get('/analytics/recommendations').then((r) => r.data),
};

export const analyticsKeys = {
  all: ['seller', 'analytics'],
  filters: ['seller', 'analytics', 'filters'],
  view: (view, params) => ['seller', 'analytics', view, params],
  recommendations: ['seller', 'analytics', 'recommendations'],
};

export const VIEW_LABELS = {
  overview: 'Overview',
  products: 'Products',
  traffic: 'Traffic & Ads',
  operations: 'Operations',
  finance: 'Finance',
};

export const VIEWS = Object.keys(VIEW_LABELS);

/** Converts a day window into the {from,to} the backend expects. */
export function daysToRange(days) {
  const to = new Date();
  const from = new Date(to.getTime() - (days - 1) * 86400_000);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}
