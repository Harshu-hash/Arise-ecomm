export const PAYMENT_ENDPOINTS = {
  intent: sessionId => `/checkout/sessions/${encodeURIComponent(sessionId)}/payment-intent`,
  payment: paymentId => `/payments/${encodeURIComponent(paymentId)}`,
  confirm: paymentId => `/payments/${encodeURIComponent(paymentId)}/confirm`,
  orders: '/orders',
  methods: '/payment-methods',
  method: paymentMethodId => `/payment-methods/${encodeURIComponent(paymentMethodId)}`,
  setupSession: '/payment-methods/setup-sessions',
};
