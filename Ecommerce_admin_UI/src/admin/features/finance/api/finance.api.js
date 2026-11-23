import { api, http } from '@core/api/axiosInstance';

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

  // Seller money: each delivered item (read only) credits the seller's wallet; sellers withdraw it and an admin approves and pays each request.
  settlements: (params) => api.get('/settlements', params),
  settlementSummary: () => api.get('/settlements/summary'),
  settlement: (id) => api.get(`/settlements/${id}`),
  holdSellerPayouts: (sellerId, payload) => api.post(`/sellers/${sellerId}/payout-hold`, payload),
  markCodRemitted: (lineIds) => api.post('/settlements/cod-remitted', { lineIds }),
  adjustWallet: (sellerId, payload) => api.post(`/seller-wallets/${sellerId}/adjustments`, payload),
  withdrawals: (params) => api.get('/withdrawals', params),
  approveWithdrawal: (id) => api.post(`/withdrawals/${id}/approve`, {}),
  rejectWithdrawal: (id, payload) => api.post(`/withdrawals/${id}/reject`, payload),
  payWithdrawal: (id, payload) => api.post(`/withdrawals/${id}/pay`, payload),

  commissionRules: (params) => api.get('/commission-rules', params),
  updateCommissionRule: (id, payload) => api.patch(`/commission-rules/${id}`, payload),
  updateFeeConfig: (payload) => api.patch('/fee-config', payload),
  previewFees: (payload) => api.post('/commission-rules/preview', payload),

  taxSummaries: (params) => api.get('/tax-summaries', params),

  codRemittances: (params) => api.get('/cod-remittances', params),
  disputeRemittance: (id, payload) => api.post(`/cod-remittances/${id}/dispute`, payload),

  invoices: (params) => api.get('/invoices', params),
  downloadInvoice: (id) => http.get(`/invoices/${id}/pdf`, { responseType: 'blob' }).then((response) => response.data),
  resendInvoice: (id) => api.post(`/invoices/${id}/resend`, {}),
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
  withdrawals: (p) => ['finance', 'withdrawals', p],
  bulkSellerLines: (sellerId) => ['finance', 'settlements', 'bulk', 'sellers', sellerId],
  bulkList: (p) => ['finance', 'settlements', 'bulk', 'list', p],
  commission: (p) => ['finance', 'commission', p],
  tax: (p) => ['finance', 'tax', p],
  cod: (p) => ['finance', 'cod', p],
  invoices: (p) => ['finance', 'invoices', p],
  invoice: (id) => ['finance', 'invoices', 'detail', id],
  reconciliation: (p) => ['finance', 'reconciliation', p],
};
