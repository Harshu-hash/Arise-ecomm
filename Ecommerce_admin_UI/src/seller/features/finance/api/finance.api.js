import { api } from '@core/api/axiosInstance';

export const financeApi = {
  summary: () => api.get('/finance/summary').then((r) => r.data),
  payoutDetail: (id) => api.get(`/finance/payouts/${id}`).then((r) => r.data),
  tax: () => api.get('/finance/tax').then((r) => r.data),
};

export const financeKeys = {
  summary: ['seller', 'finance', 'summary'],
  payouts: (p) => ['seller', 'finance', 'payouts', p],
  payoutDetail: (id) => ['seller', 'finance', 'payout', id],
  transactions: (p) => ['seller', 'finance', 'transactions', p],
  invoices: (p) => ['seller', 'finance', 'invoices', p],
  tax: ['seller', 'finance', 'tax'],
};
