import { env } from '../../../config/env.js';
import { paymentGateway } from '../../../infrastructure/external/payment/index.js';
import { AppError, ConflictError, NotFoundError, ValidationError } from '../../../shared/errors/AppError.js';
import { PAYMENT_STATUS, Payment, REFUND_STATUS } from '../infrastructure/persistence/payment.model.js';

// Payments for checkouts. Money moves only through Razorpay; this module records what happened and never trusts a client
// that says "paid": a payment is SUCCEEDED only after a signed checkout result or a signed webhook for the exact amount.

const OPEN = [PAYMENT_STATUS.REQUIRES_ACTION, PAYMENT_STATUS.FAILED];

// A cash-on-delivery payment is "SUCCEEDED" to the app (the order can be placed now); it is not captured money, so refunds and webhooks never touch it.
/** The payment as the app sees it. `providerAction.sdk` is what the Razorpay SDK needs to open its sheet. */
export const toPaymentDto = (payment) => ({
  id: String(payment._id),
  checkoutSessionId: String(payment.checkoutSessionId),
  method: payment.method,
  status: payment.status === PAYMENT_STATUS.COD_PENDING ? PAYMENT_STATUS.SUCCEEDED : payment.status,
  amountPaise: payment.amountPaise,
  currency: 'INR',
  providerAction: [PAYMENT_STATUS.SUCCEEDED, PAYMENT_STATUS.COD_PENDING].includes(payment.status)
    ? { type: 'NONE', url: null }
    : { type: 'SDK', url: null, returnUrl: null, sdk: { provider: 'RAZORPAY', keyId: env.RAZORPAY_KEY_ID, orderId: payment.providerOrderId, amountPaise: payment.amountPaise, currency: 'INR' } },
});

/**
 * Starts (or resumes) paying for a checkout. A payment still waiting for the customer, for the same method and amount, is
 * returned again instead of opening a second Razorpay order, so retries and double taps cost nothing.
 */
export async function createPaymentIntent({ customerId, checkoutSessionId, method, amountPaise }) {
  const existing = await Payment.findOne({ checkoutSessionId, method, amountPaise, status: { $in: OPEN } }).sort({ createdAt: -1 });
  if (existing) return existing;
  if (await findCommittedPayment(checkoutSessionId)) {
    throw new ConflictError('PAYMENT_ALREADY_MADE', 'This checkout has already been paid.');
  }
  const order = await paymentGateway.createPayment({
    amountPaise,
    receipt: String(checkoutSessionId),
    notes: { checkoutSessionId: String(checkoutSessionId) },
  });
  return Payment.create({ customerId: String(customerId), checkoutSessionId, method, amountPaise, providerOrderId: order.providerOrderId });
}

/** The customer chose cash on delivery: a payment with no gateway order. Asking again for the same checkout and amount returns the same one. */
export async function createCodPayment({ customerId, checkoutSessionId, amountPaise }) {
  const existing = await Payment.findOne({ checkoutSessionId, method: 'cod', amountPaise });
  if (existing) return existing;
  return Payment.create({ customerId: String(customerId), checkoutSessionId, method: 'cod', amountPaise, provider: 'COD', providerOrderId: `cod_${checkoutSessionId}`, status: PAYMENT_STATUS.COD_PENDING });
}

/** Any payment by id, for staff views (never expose through a customer route). */
export const getPaymentById = (paymentId) => Payment.findById(paymentId).lean();

export async function getPayment(customerId, paymentId) {
  const payment = await Payment.findOne({ _id: paymentId, customerId: String(customerId) });
  if (!payment) throw new NotFoundError('This payment does not exist.');
  return payment;
}

/** The payment that commits a checkout, if any: money captured, or cash on delivery agreed (a checkout is committed once). */
export const findCommittedPayment = (checkoutSessionId) => Payment.findOne({ checkoutSessionId, status: { $in: [PAYMENT_STATUS.SUCCEEDED, PAYMENT_STATUS.COD_PENDING] } });

/** Records a capture, whether it arrives from the customer's device or from Razorpay. Repeating it is harmless. */
async function succeed(payment, providerPaymentId) {
  if (payment.status === PAYMENT_STATUS.SUCCEEDED) return payment;
  return Payment.findOneAndUpdate(
    { _id: payment._id, status: { $ne: PAYMENT_STATUS.SUCCEEDED } },
    { $set: { status: PAYMENT_STATUS.SUCCEEDED, providerPaymentId, failureReason: null } },
    { new: true },
  ) ?? Payment.findById(payment._id);
}

/** The app's "I paid" call: only the signature Razorpay gave the customer's device proves it. */
export async function confirmFromClient(customerId, paymentId, { razorpayPaymentId, razorpayOrderId, razorpaySignature }) {
  const payment = await getPayment(customerId, paymentId);
  if (payment.method === 'cod') throw new ValidationError('Cash on delivery has nothing to confirm online.');
  if (payment.status === PAYMENT_STATUS.SUCCEEDED) return payment;
  const valid = razorpayOrderId === payment.providerOrderId
    && paymentGateway.verifyCheckout({ providerOrderId: razorpayOrderId, providerPaymentId: razorpayPaymentId, signature: razorpaySignature });
  if (!valid) throw new ValidationError('The payment could not be verified.');
  return succeed(payment, razorpayPaymentId);
}

/** Razorpay says money was captured. Returns the payment, or null when the order is not one of ours. */
export async function recordCapture({ providerOrderId, providerPaymentId, amountPaise }) {
  const payment = await Payment.findOne({ providerOrderId });
  if (!payment) return null;
  if (payment.amountPaise !== amountPaise) {
    throw new AppError({ code: 'PAYMENT_AMOUNT_MISMATCH', message: `Captured ${amountPaise} for a payment of ${payment.amountPaise}.`, status: 409 });
  }
  return succeed(payment, providerPaymentId);
}

/** A failed attempt. Never overrides a payment that has succeeded. */
export async function recordFailure({ providerOrderId, reason }) {
  return Payment.findOneAndUpdate(
    { providerOrderId, status: { $ne: PAYMENT_STATUS.SUCCEEDED } },
    { $set: { status: PAYMENT_STATUS.FAILED, failureReason: String(reason ?? 'Payment failed').slice(0, 300) } },
    { new: true },
  );
}

/**
 * Pays back part (or all) of a succeeded payment. `key` names this refund (e.g. one cancelled parcel): asking again with the
 * same key never pays twice, and a FAILED one is retried. Refunds can never add up to more than was paid.
 */
export async function refundPayment(paymentId, { key = 'all', amountPaise = null, reason }) {
  const payment = await Payment.findById(paymentId);
  if (!payment || payment.status !== PAYMENT_STATUS.SUCCEEDED) throw new ConflictError('PAYMENT_NOT_REFUNDABLE', 'There is no completed payment to refund.');
  const existing = payment.refunds.find((refund) => refund.key === key);
  if (existing && existing.status !== REFUND_STATUS.FAILED) return payment;
  const amount = amountPaise ?? payment.amountPaise - refundedPaise(payment);
  if (amount < 1 || refundedPaise(payment) + amount > payment.amountPaise) throw new ConflictError('REFUND_TOO_LARGE', 'That is more than is left to refund on this payment.');
  const entry = existing ?? payment.refunds[payment.refunds.push({ key, status: REFUND_STATUS.PENDING, amountPaise: amount, reason, initiatedAt: new Date() }) - 1];
  try {
    const refund = await paymentGateway.refund({ providerPaymentId: payment.providerPaymentId, amountPaise: amount, notes: { reason }, idempotencyKey: `refund_${payment._id}_${key}`.replace(/[^A-Za-z0-9_-]/g, '_') }); // Razorpay allows only letters, digits, _ and -
    entry.status = refund.providerStatus === 'processed' ? REFUND_STATUS.SUCCEEDED : REFUND_STATUS.PENDING;
    entry.providerRefundId = refund.providerRefundId;
    entry.amountPaise = amount;
    entry.failureReason = null;
  } catch (error) {
    entry.status = REFUND_STATUS.FAILED;
    entry.failureReason = String(error.cause?.message ?? error.message).slice(0, 300); // the gateway wraps Razorpay's own words as the cause
    await payment.save();
    throw error; // the caller decides whether this blocks; the FAILED entry is what ops retries from
  }
  return payment.save();
}

/** What is already given back or on its way (failed refunds do not count). */
export const refundedPaise = (payment) => payment.refunds.filter((refund) => refund.status !== REFUND_STATUS.FAILED).reduce((sum, refund) => sum + refund.amountPaise, 0);

/** Razorpay's refund webhooks. */
export async function recordRefund({ providerRefundId, providerStatus }) {
  const status = providerStatus === 'processed' ? REFUND_STATUS.SUCCEEDED : providerStatus === 'failed' ? REFUND_STATUS.FAILED : null;
  if (status && providerRefundId) await Payment.updateOne({ 'refunds.providerRefundId': providerRefundId }, { $set: { 'refunds.$.status': status } });
}
