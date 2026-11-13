import { api } from '@core/api/axiosInstance';

export const financeApi = {
  overview: () => api.get('/finance/overview'),

  /** Queues an export job; it lands in the Export Center when ready. */
  exportDataset: (dataset, filters) => api.post('/finance/export', { dataset, filters }),

  payments: (params) => api.get('/payments', params),
  payment: (id) => api.get(`/payments/${id}`),

  refunds: (params) => api.get('/refunds', params),
  createRefund: (payload) => api.post('/refunds', payload),
  retryRefund: (id) => api.post(`/refunds/${id}/retry`, {}),
  switchRefundMode: (id, payload) => api.post(`/refunds/${id}/mode`, payload),

  // Per-order-item seller settlements (the payout flow). A seller is paid for
  // one delivered item once its return window closes; see the settlements mock.
  settlements: (params) => api.get('/settlements', params),
  settlementSummary: () => api.get('/settlements/summary'),
  settlement: (id) => api.get(`/settlements/${id}`),
  setSettlementIssues: (id, issues) => api.patch(`/settlements/${id}/issues`, { issues }),
  reviewSettlement: (id) => api.post(`/settlements/${id}/review`, {}),
  paySettlement: (id, payload) => api.post(`/settlements/${id}/pay`, payload),
  retrySettlement: (id, payload) => api.post(`/settlements/${id}/retry`, payload),
  releaseSettlementHold: (id) => api.post(`/settlements/${id}/release-hold`, {}),
  holdSellerPayouts: (sellerId, payload) => api.post(`/sellers/${sellerId}/payout-hold`, payload),

  // Bulk settlement: pay many of one seller's ready items under one reference.
  bulkSellers: () => api.get('/settlements/bulk/sellers'),
  bulkSellerLines: (sellerId) => api.get(`/settlements/bulk/sellers/${sellerId}/lines`),
  bulkPreview: (payload) => api.post('/settlements/bulk/preview', payload),
  bulkPay: (payload) => api.post('/settlements/bulk/pay', payload),
  bulkList: (params) => api.get('/settlements/bulk', params),
  bulk: (refNo) => api.get(`/settlements/bulk/${refNo}`),

  commissionRules: (params) => api.get('/commission-rules', params),
  updateCommissionRule: (id, payload) => api.patch(`/commission-rules/${id}`, payload),
  updateFeeConfig: (payload) => api.patch('/fee-config', payload),
  previewFees: (payload) => api.post('/commission-rules/preview', payload),

  taxSummaries: (params) => api.get('/tax-summaries', params),

  codRemittances: (params) => api.get('/cod-remittances', params),
  disputeRemittance: (id, payload) => api.post(`/cod-remittances/${id}/dispute`, payload),

  invoices: (params) => api.get('/invoices', params),
  invoice: (id) => api.get(`/invoices/${id}`),
  regenerateInvoice: (id, payload) => api.post(`/invoices/${id}/regenerate`, payload),

  reconciliation: (params) => api.get('/reconciliation', params),
  runReconciliation: (payload) => api.post('/reconciliation', payload),
};

export const financeKeys = {
  overview: ['finance', 'overview'],
  payments: (p) => ['finance', 'payments', p],
  refunds: (p) => ['finance', 'refunds', p],
  settlements: (p) => ['finance', 'settlements', p],
  settlementSummary: ['finance', 'settlements', 'summary'],
  settlement: (id) => ['finance', 'settlements', 'detail', id],
  bulkSellers: ['finance', 'settlements', 'bulk', 'sellers'],
  bulkSellerLines: (sellerId) => ['finance', 'settlements', 'bulk', 'sellers', sellerId],
  bulkList: (p) => ['finance', 'settlements', 'bulk', 'list', p],
  commission: (p) => ['finance', 'commission', p],
  tax: (p) => ['finance', 'tax', p],
  cod: (p) => ['finance', 'cod', p],
  invoices: (p) => ['finance', 'invoices', p],
  invoice: (id) => ['finance', 'invoices', 'detail', id],
  reconciliation: (p) => ['finance', 'reconciliation', p],
};
