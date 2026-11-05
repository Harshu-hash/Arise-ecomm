import { api } from '@core/api/axiosInstance';

export const financeApi = {
  summary: () => api.get('/finance/summary').then((r) => r.data),
  payoutDetail: (id) => api.get(`/finance/payouts/${id}`).then((r) => r.data),
  tax: () => api.get('/finance/tax').then((r) => r.data),
  adjustments: () => api.get('/finance/adjustments').then((r) => r.data),
  reconciliationDetail: (id) => api.get(`/finance/reconciliation/${id}`).then((r) => r.data),
  disputeLine: (id, payload) => api.post(`/finance/reconciliation/${id}/disputes`, payload).then((r) => r.data),
  fees: () => api.get('/finance/fees').then((r) => r.data),
  previewFees: (payload) => api.post('/finance/fees/preview', payload).then((r) => r.data),
  documents: (params) => api.get('/finance/documents', params).then((r) => r.data),
  generateDocument: (payload) => api.post('/finance/documents', payload).then((r) => r.data),
  retryDocument: (id) => api.post(`/finance/documents/${id}/retry`, {}).then((r) => r.data),
};

export const financeKeys = {
  summary: ['seller', 'finance', 'summary'],
  payouts: (p) => ['seller', 'finance', 'payouts', p],
  payoutDetail: (id) => ['seller', 'finance', 'payout', id],
  transactions: (p) => ['seller', 'finance', 'transactions', p],
  invoices: (p) => ['seller', 'finance', 'invoices', p],
  tax: ['seller', 'finance', 'tax'],
  reconciliation: (p) => ['seller', 'finance', 'reconciliation', p],
  reconciliationDetail: (id) => ['seller', 'finance', 'reconciliation', id],
  fees: ['seller', 'finance', 'fees'],
  documents: (entityType, entityId) => ['seller', 'finance', 'documents', entityType, entityId],
};
