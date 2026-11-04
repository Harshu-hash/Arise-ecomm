export const RETURN_ENDPOINTS = {
  eligibility: orderId => `/orders/${encodeURIComponent(orderId)}/returnable-items`,
  create: '/returns',
  detail: returnId => `/returns/${encodeURIComponent(returnId)}`,
  cancel: returnId => `/returns/${encodeURIComponent(returnId)}/cancel`,
};
