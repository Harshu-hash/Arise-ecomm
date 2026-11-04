export const ORDER_ENDPOINTS = {
  list: '/orders',
  detail: orderId => `/orders/${encodeURIComponent(orderId)}`,
  timeline: orderId => `/orders/${encodeURIComponent(orderId)}/timeline`,
  cancel: orderId => `/orders/${encodeURIComponent(orderId)}/cancel`,
};
