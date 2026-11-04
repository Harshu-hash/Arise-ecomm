import { AxiosError } from 'axios';
import { createCartFixtureEnvelope, completeCartFixture } from './customerCartAdapter';
import { getAddressFixture } from './customerAddressAdapter';
import { getProductCardFixture } from './customerSearchProductAdapter';

const LATENCY_MS = 300;
let sessionCounter = 1;
let paymentCounter = 1;
let orderCounter = 10001;
const sessions = new Map();
const payments = new Map();
const ordersByKey = new Map();
const sessionsByKey = new Map();
const paymentsByKey = new Map();

const wait = () => new Promise(resolve => setTimeout(resolve, LATENCY_MS));
const response = (config, data, status = 200) => ({
  data,
  status,
  statusText: status < 400 ? 'OK' : 'Error',
  headers: { 'content-type': 'application/json' },
  config,
  request: null,
});
const reject = (config, status, code, message) => {
  throw new AxiosError(
    message,
    code,
    config,
    null,
    response(config, { error: { code, message } }, status),
  );
};
const keyFrom = config =>
  config.headers?.['Idempotency-Key'] || config.headers?.['idempotency-key'];
const checkoutLine = item => ({
  lineId: item.cartItemId || `buy-${item.productId}`,
  productId: item.productId,
  name: item.name,
  imageUrl: item.imageUrl,
  variantLabel: item.variantLabel || 'Standard',
  quantity: item.quantity || 1,
  unitPricePaise: item.pricePaise,
  mrpPaise: item.mrpPaise,
  lineTotalPaise: item.pricePaise * (item.quantity || 1),
  sellerId: item.sellerId || 'seller-arise-select',
  sellerName: item.sellerName || 'Arise Select',
  deliveryPromise: item.deliveryLabel || '3-5 days',
});
const totalsFromLines = (lines, cartTotals) => {
  if (cartTotals) return { ...cartTotals, taxPaise: 0, walletCreditPaise: 0 };
  const subtotalPaise = lines.reduce((sum, line) => sum + line.lineTotalPaise, 0);
  const mrpPaise = lines.reduce((sum, line) => sum + line.mrpPaise * line.quantity, 0);
  return {
    mrpPaise,
    subtotalPaise,
    productDiscountPaise: Math.max(mrpPaise - subtotalPaise, 0),
    couponDiscountPaise: 0,
    deliveryFeePaise: subtotalPaise >= 50000 ? 0 : 4000,
    platformFeePaise: 500,
    taxPaise: 0,
    walletCreditPaise: 0,
    payablePaise: subtotalPaise + (subtotalPaise >= 50000 ? 0 : 4000) + 500,
  };
};
const createSession = (config, input) => {
  const address = getAddressFixture(input.addressId);
  if (!address) return reject(config, 404, 'ADDRESS_NOT_FOUND', 'Select a valid delivery address.');
  const source = input.source === 'BUY_NOW' ? 'BUY_NOW' : 'CART';
  let lines;
  let cartVersion = null;
  let cartTotals = null;
  let couponCode = null;
  if (source === 'CART') {
    const cart = createCartFixtureEnvelope().data;
    if (!cart.items.length) return reject(config, 409, 'CART_EMPTY', 'Your cart is empty.');
    if (!cart.checkoutAllowed)
      return reject(config, 409, 'CART_BLOCKED', 'Resolve cart issues first.');
    lines = cart.items.map(checkoutLine);
    cartVersion = cart.version;
    cartTotals = cart.totals;
    couponCode = cart.appliedCoupon?.code ?? null;
  } else {
    lines = (input.items || [])
      .map(requestItem => {
        const product = getProductCardFixture(requestItem.productId);
        if (!product) return null;
        return checkoutLine({
          ...product,
          productId: product.id,
          quantity: requestItem.quantity,
          variantLabel: requestItem.variantLabel,
        });
      })
      .filter(Boolean);
    if (!lines.length) return reject(config, 409, 'BUY_NOW_EMPTY', 'Select a product to continue.');
  }
  const session = {
    id: `checkout-${sessionCounter++}`,
    status: 'READY',
    source,
    cartVersion,
    address,
    lines,
    totals: totalsFromLines(lines, cartTotals),
    couponCode,
    allowedPaymentMethods: ['upi', 'card', 'cod', 'wallet'],
    selectedPaymentMethod: null,
    codEligible: true,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    warnings: [],
    blockers: [],
  };
  sessions.set(session.id, session);
  return session;
};

export const resetCustomerCheckoutPaymentFixture = () => {
  sessionCounter = 1;
  paymentCounter = 1;
  orderCounter = 10001;
  sessions.clear();
  payments.clear();
  ordersByKey.clear();
  sessionsByKey.clear();
  paymentsByKey.clear();
};

export const customerCheckoutPaymentFixtureAdapter = async config => {
  await wait();
  if (config.url === '/checkout/sessions' && config.method === 'post') {
    const key = keyFrom(config);
    if (!key)
      return reject(config, 400, 'IDEMPOTENCY_KEY_REQUIRED', 'A checkout request key is required.');
    const existing = sessionsByKey.get(key);
    if (existing) return response(config, { data: existing });
    const session = createSession(config, config.data || {});
    sessionsByKey.set(key, session);
    return response(config, { data: session }, 201);
  }
  const sessionMatch = config.url?.match(/^\/checkout\/sessions\/([^/]+)$/);
  if (sessionMatch && config.method === 'get') {
    const session = sessions.get(decodeURIComponent(sessionMatch[1]));
    if (!session)
      return reject(config, 404, 'CHECKOUT_NOT_FOUND', 'This checkout session expired.');
    return response(config, { data: session });
  }
  const paymentMethodMatch = config.url?.match(/^\/checkout\/sessions\/([^/]+)\/payment-method$/);
  if (paymentMethodMatch && config.method === 'patch') {
    const session = sessions.get(decodeURIComponent(paymentMethodMatch[1]));
    if (!session)
      return reject(config, 404, 'CHECKOUT_NOT_FOUND', 'This checkout session expired.');
    if (!session.allowedPaymentMethods.includes(config.data?.paymentMethod)) {
      return reject(config, 409, 'PAYMENT_METHOD_UNAVAILABLE', 'Choose another payment method.');
    }
    session.selectedPaymentMethod = config.data.paymentMethod;
    return response(config, { data: session });
  }
  const addressMatch = config.url?.match(/^\/checkout\/sessions\/([^/]+)\/address$/);
  if (addressMatch && config.method === 'patch') {
    const session = sessions.get(decodeURIComponent(addressMatch[1]));
    const address = getAddressFixture(config.data?.addressId);
    if (!session || !address)
      return reject(config, 404, 'ADDRESS_NOT_FOUND', 'Select a valid address.');
    session.address = address;
    return response(config, { data: session });
  }
  const revalidateMatch = config.url?.match(/^\/checkout\/sessions\/([^/]+)\/revalidate$/);
  if (revalidateMatch && config.method === 'post') {
    const session = sessions.get(decodeURIComponent(revalidateMatch[1]));
    if (!session)
      return reject(config, 404, 'CHECKOUT_NOT_FOUND', 'This checkout session expired.');
    return response(config, { data: session });
  }
  const intentMatch = config.url?.match(/^\/checkout\/sessions\/([^/]+)\/payment-intent$/);
  if (intentMatch && config.method === 'post') {
    const session = sessions.get(decodeURIComponent(intentMatch[1]));
    if (!session)
      return reject(config, 404, 'CHECKOUT_NOT_FOUND', 'This checkout session expired.');
    const key = keyFrom(config);
    if (!key)
      return reject(config, 400, 'IDEMPOTENCY_KEY_REQUIRED', 'A payment request key is required.');
    const existing = paymentsByKey.get(key);
    if (existing) return response(config, { data: existing });
    const method = config.data?.method;
    if (!session.allowedPaymentMethods.includes(method)) {
      return reject(config, 409, 'PAYMENT_METHOD_UNAVAILABLE', 'Choose another payment method.');
    }
    const payment = {
      id: `payment-${paymentCounter++}`,
      checkoutSessionId: session.id,
      method,
      status: method === 'cod' ? 'SUCCEEDED' : 'CREATED',
      amountPaise: session.totals.payablePaise,
      currency: 'INR',
      providerAction: { type: 'NONE', url: null },
    };
    payments.set(payment.id, payment);
    paymentsByKey.set(key, payment);
    return response(config, { data: payment }, 201);
  }
  const confirmMatch = config.url?.match(/^\/payments\/([^/]+)\/confirm$/);
  if (confirmMatch && config.method === 'post') {
    const payment = payments.get(decodeURIComponent(confirmMatch[1]));
    if (!payment)
      return reject(config, 404, 'PAYMENT_NOT_FOUND', 'The payment attempt was not found.');
    payment.status = 'SUCCEEDED';
    return response(config, { data: payment });
  }
  const paymentMatch = config.url?.match(/^\/payments\/([^/]+)$/);
  if (paymentMatch && config.method === 'get') {
    const payment = payments.get(decodeURIComponent(paymentMatch[1]));
    if (!payment)
      return reject(config, 404, 'PAYMENT_NOT_FOUND', 'The payment attempt was not found.');
    return response(config, { data: payment });
  }
  if (config.url === '/orders' && config.method === 'post') {
    const key = keyFrom(config);
    if (!key)
      return reject(config, 400, 'IDEMPOTENCY_KEY_REQUIRED', 'An order request key is required.');
    const existing = ordersByKey.get(key);
    if (existing) return response(config, { data: existing });
    const session = sessions.get(config.data?.checkoutSessionId);
    const payment = payments.get(config.data?.paymentId);
    if (!session || !payment || payment.status !== 'SUCCEEDED') {
      return reject(
        config,
        409,
        'PAYMENT_NOT_CONFIRMED',
        'Confirm payment before placing the order.',
      );
    }
    const order = {
      id: `ORD-${orderCounter++}`,
      placedAt: new Date().toISOString(),
      status: 'CONFIRMED',
      paymentMethod: payment.method.toUpperCase(),
      paymentStatus: payment.method === 'cod' ? 'COD_PENDING' : 'PAID',
      amountPaise: session.totals.payablePaise,
      deliveryCode: '4821',
      address: session.address,
      items: session.lines.map(line => ({
        id: line.lineId,
        productId: line.productId,
        name: line.name,
        imageUrl: line.imageUrl,
        variantLabel: line.variantLabel,
        quantity: line.quantity,
        unitPricePaise: line.unitPricePaise,
        mrpPaise: line.mrpPaise,
      })),
      totals: session.totals,
    };
    ordersByKey.set(key, order);
    session.status = 'COMPLETED';
    if (session.source === 'CART') completeCartFixture();
    return response(config, { data: order }, 201);
  }
  return reject(
    config,
    501,
    'FIXTURE_NOT_IMPLEMENTED',
    `No fixture exists for ${config.method?.toUpperCase()} ${config.url}.`,
  );
};

export const getCheckoutSessionFixture = sessionId => sessions.get(sessionId) ?? null;
export const getCreatedOrderFixtures = () => [...ordersByKey.values()];
