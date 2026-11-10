import { createHmac, timingSafeEqual } from 'node:crypto';
import Razorpay from 'razorpay';
import { env } from '../../../config/env.js';
import { AppError } from '../../../shared/errors/AppError.js';

// Razorpay adapter for the PaymentGateway port (ARCHITECTURE.md §9). Business-level names, integer paise.
// Card data never touches this backend: Razorpay Checkout collects it client-side.
let client;

function credentials() {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    throw new AppError({ code: 'PAYMENT_NOT_CONFIGURED', message: 'Payment gateway is not configured.', status: 503 });
  }
  return { key_id: env.RAZORPAY_KEY_ID, key_secret: env.RAZORPAY_KEY_SECRET };
}

function getClient() {
  client ??= new Razorpay(credentials());
  return client;
}

function safeEqual(expected, received) {
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(String(received ?? ''), 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

async function call(work) {
  try {
    return await work();
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError({
      code: 'PAYMENT_GATEWAY_ERROR',
      message: 'The payment gateway could not process the request.',
      status: 502,
      retryable: !error?.statusCode || error.statusCode >= 500,
      cause: error,
    });
  }
}

const toPayment = (p) => ({
  providerPaymentId: p.id,
  providerOrderId: p.order_id,
  amountPaise: p.amount,
  currency: p.currency,
  providerStatus: p.status, // created | authorized | captured | refunded | failed
  method: p.method ?? null,
});

export const razorpayGateway = {
  // `receipt` should be our order/attempt id (max 40 chars) so the gateway order maps back to ours.
  createPayment: ({ amountPaise, currency = 'INR', receipt, notes }) =>
    call(async () => {
      const order = await getClient().orders.create({ amount: amountPaise, currency, receipt, notes });
      return { providerOrderId: order.id, amountPaise: order.amount, currency: order.currency, keyId: env.RAZORPAY_KEY_ID };
    }),

  fetchPayment: (providerPaymentId) => call(async () => toPayment(await getClient().payments.fetch(providerPaymentId))),

  // The SDK cannot send custom headers, so refunds call the REST API directly: X-Refund-Idempotency
  // makes a retried refund return the original refund instead of creating a second one.
  refund: ({ providerPaymentId, amountPaise, notes, idempotencyKey }) =>
    call(async () => {
      const { key_id: id, key_secret: secret } = credentials();
      const response = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(providerPaymentId)}/refund`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`,
          'Content-Type': 'application/json',
          'X-Refund-Idempotency': idempotencyKey,
        },
        body: JSON.stringify({ amount: amountPaise, notes, speed: 'normal' }),
        signal: AbortSignal.timeout(15_000),
      });
      const body = await response.json();
      if (!response.ok) {
        throw Object.assign(new Error(body?.error?.description ?? 'Refund failed'), { statusCode: response.status });
      }
      return { providerRefundId: body.id, providerPaymentId: body.payment_id, amountPaise: body.amount, providerStatus: body.status };
    }),

  // Checkout callback: HMAC_SHA256(order_id|payment_id, key_secret). Never trust the client result without it.
  verifyCheckout: ({ providerOrderId, providerPaymentId, signature }) => {
    if (!env.RAZORPAY_KEY_SECRET) return false;
    const expected = createHmac('sha256', env.RAZORPAY_KEY_SECRET).update(`${providerOrderId}|${providerPaymentId}`).digest('hex');
    return safeEqual(expected, signature);
  },

  // Webhook: HMAC_SHA256(raw request body, webhook secret). Must be given the exact raw bytes.
  verifyWebhook: (rawBody, signature) => {
    if (!env.RAZORPAY_WEBHOOK_SECRET || !Buffer.isBuffer(rawBody)) return false;
    return safeEqual(createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest('hex'), signature);
  },

  // Normalises a verified webhook body so payment-module handlers never touch Razorpay's payload shape.
  parseWebhook: (body) => {
    const payment = body?.payload?.payment?.entity;
    const refund = body?.payload?.refund?.entity;
    return {
      eventType: body?.event,
      occurredAt: body?.created_at ? new Date(body.created_at * 1000) : null,
      payment: payment ? toPayment(payment) : null,
      refund: refund
        ? { providerRefundId: refund.id, providerPaymentId: refund.payment_id, amountPaise: refund.amount, providerStatus: refund.status }
        : null,
    };
  },
};
