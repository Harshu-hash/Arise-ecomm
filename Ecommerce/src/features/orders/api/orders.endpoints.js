export const ORDER_ENDPOINTS = {
  list: '/orders',
  detail: orderId => `/orders/${encodeURIComponent(orderId)}`,
  timeline: orderId => `/orders/${encodeURIComponent(orderId)}/timeline`,
  invoices: orderId => `/orders/${encodeURIComponent(orderId)}/invoices`,
  cancel: orderId => `/orders/${encodeURIComponent(orderId)}/cancel`,
};
