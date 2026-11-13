import { api } from '@core/api/axiosInstance';

/**
 * Platform analytics. Each domain is aggregated server-side from live orders,
 * finance records, tickets and so on (see the admin reports handler), so the
 * UI only selects a domain and a window.
 */
export const analyticsApi = {
  domain: (domain, days) =>
    api.get(`/reports/analytics/${domain}`, { days }).then((r) => r.data),
};

export const analyticsKeys = {
  all: ['admin', 'analytics'],
  domain: (domain, days) => ['admin', 'analytics', domain, days],
};

export const DOMAIN_LABELS = {
  sales: 'Sales',
  customers: 'Customers',
  catalog: 'Catalog',
  sellers: 'Sellers',
  fulfilment: 'Fulfilment',
  returns: 'Returns',
  finance: 'Finance',
  marketing: 'Marketing',
  support: 'Support',
};

export const DOMAINS = Object.keys(DOMAIN_LABELS);
