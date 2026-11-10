// Single switch point for the PaymentGateway port; modules import this, never a provider file.
export { razorpayGateway as paymentGateway } from './razorpay.gateway.js';
