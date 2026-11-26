export const CHECKOUT_ENDPOINTS = {
  sessions: '/checkout/sessions',
  preview: '/checkout/preview',
  session: sessionId => `/checkout/sessions/${encodeURIComponent(sessionId)}`,
  address: sessionId => `/checkout/sessions/${encodeURIComponent(sessionId)}/address`,
  paymentMethod: sessionId => `/checkout/sessions/${encodeURIComponent(sessionId)}/payment-method`,
  wallet: sessionId => `/checkout/sessions/${encodeURIComponent(sessionId)}/wallet`,
  revalidate: sessionId => `/checkout/sessions/${encodeURIComponent(sessionId)}/revalidate`,
  paymentIntent: sessionId => `/checkout/sessions/${encodeURIComponent(sessionId)}/payment-intent`,
};
