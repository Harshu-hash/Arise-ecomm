import { AppError, NotFoundError } from '../../../shared/errors/AppError.js';
import { getSettingsSection } from '../../admin/public/index.js';
import { getCart, LINE_ISSUE, resolveLines } from '../../cart/public/index.js';
import { getCategoryTerms } from '../../category/public/index.js';
import { evaluateCouponsForCart } from '../../coupon/public/index.js';
import { getAddress, getDefaultAddress } from '../../customer/public/index.js';
import { getSellerSummaries } from '../../identity/public/index.js';
import { getSpendableBalance } from '../../wallet/public/index.js';
import { createCodPayment, createPaymentIntent, findCommittedPayment, toPaymentDto } from '../../payment/public/index.js';
import { findVariantIdByLabel, holdStock, pickOfferId } from '../../product/public/index.js';
import { quoteShipping } from '../../shipping/public/index.js';
import { priceOrder } from '../domain/services/orderMoney.js';
import { CheckoutSession, SESSION_STATUS } from '../infrastructure/persistence/checkoutSession.model.js';

// Checkout: turns a cart (or a "buy now") plus an address into a priced quote the customer can pay.
// Every line is judged by resolveLines, the same check the cart uses, then priced per seller with a real delivery quote.
// Nothing is charged or held here; stock is held and the Razorpay order opened only when payment starts (createIntent).

const failure = (status, code, message, details = null) => new AppError({ code, message, status, details });
const METHODS = { UPI: 'upi', CARDS: 'card' }; // the settings' names for what the app calls upi and card; cash on delivery (cod) is decided per checkout
const MIN_PAYMENT_PAISE = 100; // Razorpay refuses less than ₹1

const ISSUE_TEXT = {
  [LINE_ISSUE.OFFER_UNAVAILABLE]: () => 'An item in your order is no longer available.',
  [LINE_ISSUE.SELLER_UNAVAILABLE]: (line) => `${line.name} cannot be ordered from this seller right now.`,
  [LINE_ISSUE.OUT_OF_STOCK]: (line) => `${line.name} is out of stock.`,
  [LINE_ISSUE.QUANTITY_LIMIT]: (line) => `Only ${line.maximumQuantity} of ${line.name} can be bought at once.`,
};

export const stockReference = (session) => `checkout:${session._id}`;

async function allowedMethods(quote) {
  const { enabledMethods } = await getSettingsSection('payments');
  const online = Object.entries(METHODS).filter(([setting]) => enabledMethods.includes(setting)).map(([, method]) => method);
  return quote.codEligible ? [...online, 'cod'] : online;
}

/**
 * Prices a checkout from scratch for the chosen payment `method`. Cash on delivery costs a handling fee and is quoted with the courier's
 * cash-on-delivery rate, so the total depends on it. Returns the quote to store: priced lines, one parcel per seller, totals, blockers, warnings, codEligible.
 */
async function priceSession({ customerId, items, couponCode, address, method = null, useWallet = false }) {
  const resolved = await resolveLines(items.map((item) => ({ offerId: String(item.offerId), quantity: item.quantity })));
  const lines = resolved.filter((line) => line.sellable);
  const blockers = resolved.filter((line) => !line.sellable).map((line) => ISSUE_TEXT[line.issueCode](line));
  const warnings = [];

  const [sellers, terms, fees, payments, orders] = await Promise.all([
    getSellerSummaries(lines.map((line) => line.sellerId)),
    getCategoryTerms(lines.map((line) => line.categoryId)),
    getSettingsSection('fees'),
    getSettingsSection('payments'),
    getSettingsSection('orders'),
  ]);
  const cash = method === 'cod';
  const codOn = payments.codEnabled && payments.enabledMethods.includes('COD');
  let codProblem = codOn ? null : 'Cash on delivery is not available right now.';

  // One parcel per seller, quoted for its total weight.
  const shipping = new Map();
  const parcels = new Map();
  const sellerIds = [...new Set(lines.map((line) => line.sellerId))];
  await Promise.all(sellerIds.map(async (sellerId) => {
    const weightG = lines.filter((line) => line.sellerId === sellerId).reduce((sum, line) => sum + line.weightG * line.quantity, 0);
    const where = { pickupPincode: sellers.get(sellerId)?.pincode, deliveryPincode: address.pincode, weightG };
    const [prepaid, cod] = await Promise.all([quoteShipping(where), codOn ? quoteShipping({ ...where, cod: true }) : null]);
    // cash on delivery needs a courier that really collects cash there: a flat-fee fallback is not proof of that
    if (codOn && !(cod.serviceable && cod.source === 'SHIPROCKET')) codProblem = `Cash on delivery is not available to ${address.pincode}.`;
    const quote = cash && cod ? cod : prepaid;
    if (!quote.serviceable) blockers.push(`${sellers.get(sellerId)?.name ?? 'This seller'} cannot deliver to ${address.pincode}.`);
    shipping.set(sellerId, quote.serviceable ? quote.feePaise : 0);
    parcels.set(sellerId, { etaDays: quote.etaDays, shippingSource: quote.source });
  }));

  let coupon = null;
  if (couponCode && lines.length) {
    const [found] = await evaluateCouponsForCart(customerId, lines, { code: couponCode });
    if (found?.applicable) coupon = { code: found.code, type: found.type, discountPaise: found.discountPaise };
    else warnings.push(`${couponCode} no longer applies to this order.`);
  }

  const platformFeePaise = lines.length ? fees.platformFeePaise : 0;
  const priced = priceOrder({ lines, shipping, coupon, platformFeePaise, codFeePaise: cash ? fees.codConvenienceFeePaise : 0, terms });
  // Store credit pays part of an online order: capped by the admin's share limit, and always leaves the minimum Razorpay can charge.
  let walletCreditPaise = 0;
  if (useWallet && !cash && lines.length && payments.enabledMethods.includes('WALLET')) {
    const cap = Math.floor((priced.totals.payablePaise * payments.walletUsageCapPct) / 100);
    walletCreditPaise = Math.max(0, Math.min(await getSpendableBalance(customerId), cap, priced.totals.payablePaise - MIN_PAYMENT_PAISE));
  }
  priced.totals = { ...priced.totals, walletCreditPaise, payablePaise: priced.totals.payablePaise - walletCreditPaise };
  const toPay = priced.totals.payablePaise - priced.totals.codFeePaise;
  if (!codProblem && (toPay < orders.codMinPaise || toPay > orders.codMaxPaise)) {
    codProblem = `Cash on delivery is available for orders between Rs ${orders.codMinPaise / 100} and Rs ${orders.codMaxPaise / 100}.`;
  }
  if (cash && codProblem) blockers.push(codProblem);
  return {
    lines: priced.lines,
    sellers: priced.sellers.map(({ lines: _lines, ...seller }) => ({
      ...seller,
      sellerName: sellers.get(seller.sellerId)?.name ?? 'Seller',
      ...parcels.get(seller.sellerId),
    })),
    totals: priced.totals,
    couponCode: coupon?.code ?? null,
    codEligible: !codProblem,
    blockers,
    warnings,
  };
}

const isExpired = (session) => session.status === SESSION_STATUS.EXPIRED || (session.status === SESSION_STATUS.OPEN && session.expiresAt <= new Date());

function statusOf(session) {
  if (session.status === SESSION_STATUS.PLACED) return 'COMPLETED';
  if (isExpired(session)) return 'EXPIRED';
  return session.quote.blockers.length ? 'BLOCKED' : 'READY';
}

const promise = (days) => (days ? `Delivers in about ${days} days` : 'Standard delivery');

export async function toSessionDto(session) {
  const { quote } = session;
  const parcels = new Map(quote.sellers.map((seller) => [seller.sellerId, seller]));
  return {
    id: String(session._id),
    status: statusOf(session),
    source: session.source,
    cartVersion: session.cartVersion,
    address: session.address,
    lines: quote.lines.map((line) => ({
      lineId: String(line.offerId),
      productId: line.productId,
      name: line.name,
      imageUrl: line.imageUrl,
      variantLabel: line.variantLabel,
      quantity: line.quantity,
      unitPricePaise: line.unitPricePaise,
      mrpPaise: line.mrpPaise,
      lineTotalPaise: line.amountPaise,
      sellerId: line.sellerId,
      sellerName: line.sellerName,
      deliveryPromise: promise(parcels.get(line.sellerId)?.etaDays),
    })),
    totals: quote.totals,
    couponCode: quote.couponCode,
    allowedPaymentMethods: await allowedMethods(quote),
    selectedPaymentMethod: session.selectedPaymentMethod,
    useWallet: Boolean(session.useWallet),
    walletBalancePaise: await getSpendableBalance(session.customerId),
    codEligible: Boolean(quote.codEligible),
    expiresAt: session.expiresAt.toISOString(),
    warnings: quote.warnings,
    blockers: quote.blockers,
  };
}

async function load(customerId, id) {
  const session = await CheckoutSession.findOne({ _id: id, customerId: String(customerId) });
  if (!session) throw new NotFoundError('This checkout does not exist.');
  return session;
}

// A checkout that has been paid for is frozen: the order is written from the quote that was charged.
async function assertOpen(session) {
  if (session.status === SESSION_STATUS.PLACED) throw failure(409, 'CHECKOUT_COMPLETED', 'This checkout is already complete.');
  if (isExpired(session)) throw failure(410, 'CHECKOUT_EXPIRED', 'This checkout expired. Start again from your cart.');
  if (await findCommittedPayment(session._id)) throw failure(409, 'CHECKOUT_PAID', 'This checkout is already paid and its order is being placed.');
}

const noLines = (quote) => failure(409, 'CHECKOUT_UNAVAILABLE', quote.blockers[0] ?? 'Nothing in this order can be bought right now.', { blockers: quote.blockers });

async function reprice(session) {
  session.quote = await priceSession({ customerId: session.customerId, items: session.items, couponCode: session.couponCode, address: session.address, method: session.selectedPaymentMethod, useWallet: session.useWallet });
  if (!session.quote.lines.length) throw noLines(session.quote);
  session.markModified('quote');
  await session.save();
  return session;
}

/** One entry per offer: the same item asked for twice is one line of the summed quantity. */
function mergeItems(entries) {
  const byOffer = new Map();
  for (const { offerId, quantity } of entries) byOffer.set(String(offerId), (byOffer.get(String(offerId)) ?? 0) + quantity);
  return [...byOffer].map(([offerId, quantity]) => ({ offerId, quantity }));
}

// What is being bought and where it goes: shared by the checkout preview and the real session.
async function prepare(customerId, { source = 'CART', addressId, cartVersion, items: requested }) {
  let items;
  let couponCode = null;
  let version = null;
  if (source === 'BUY_NOW') {
    const picked = [];
    for (const entry of requested ?? []) {
      const variantId = entry.variantId ?? (entry.variantLabel ? await findVariantIdByLabel(entry.productId, entry.variantLabel) : null);
      const offerId = entry.offerId ?? await pickOfferId({ productId: entry.productId, variantId });
      if (!offerId) throw failure(409, 'PRODUCT_UNAVAILABLE', 'This product is not available right now.');
      picked.push({ offerId, quantity: entry.quantity });
    }
    items = mergeItems(picked);
  } else {
    const cart = await getCart(customerId);
    if (!cart.items.length) throw failure(409, 'CART_EMPTY', 'Your cart is empty.');
    if (cartVersion != null && cartVersion !== cart.version) throw failure(409, 'CART_CHANGED', 'Your cart changed. Review it and try again.');
    if (!cart.checkoutAllowed) throw failure(409, 'CART_BLOCKED', 'Fix the issues in your cart first.', { issues: cart.issues });
    items = mergeItems(cart.items);
    couponCode = cart.appliedCoupon?.code ?? null;
    version = cart.version;
  }
  const address = addressId ? await getAddress(customerId, addressId) : await getDefaultAddress(customerId);
  if (!address) throw failure(404, 'ADDRESS_NOT_FOUND', 'Select a delivery address.');

  return { items, couponCode, version, address };
}

/** What the order would cost to this address right now (real delivery quote, platform fee), without creating anything. */
export async function previewCheckout(customerId, body) {
  const { items, couponCode, address } = await prepare(customerId, { ...body, cartVersion: undefined });
  const quote = await priceSession({ customerId, items, couponCode, address });
  if (!quote.lines.length) throw noLines(quote);
  return { totals: quote.totals, couponCode: quote.couponCode, blockers: quote.blockers, warnings: quote.warnings };
}

export async function createSession(customerId, body) {
  const { source = 'CART' } = body;
  const { items, couponCode, version, address } = await prepare(customerId, body);
  const quote = await priceSession({ customerId, items, couponCode, address });
  if (!quote.lines.length) throw noLines(quote);
  const { paymentPendingTimeoutMins } = await getSettingsSection('orders');
  const session = await CheckoutSession.create({
    customerId: String(customerId),
    source,
    cartVersion: version,
    items,
    couponCode,
    address,
    quote,
    expiresAt: new Date(Date.now() + paymentPendingTimeoutMins * 60_000),
  });
  return toSessionDto(session);
}

export async function getSession(customerId, id) {
  const session = await load(customerId, id);
  if (isExpired(session)) throw failure(410, 'CHECKOUT_EXPIRED', 'This checkout expired. Start again from your cart.');
  return toSessionDto(session);
}

export async function setAddress(customerId, id, addressId) {
  const session = await load(customerId, id);
  await assertOpen(session);
  const address = await getAddress(customerId, addressId);
  if (!address) throw failure(404, 'ADDRESS_NOT_FOUND', 'Select a valid delivery address.');
  session.address = address;
  return toSessionDto(await reprice(session));
}

export async function setPaymentMethod(customerId, id, method) {
  const session = await load(customerId, id);
  await assertOpen(session);
  if (!(await allowedMethods(session.quote)).includes(method)) throw failure(409, 'PAYMENT_METHOD_UNAVAILABLE', 'Choose another payment method.');
  const repricing = (session.selectedPaymentMethod === 'cod') !== (method === 'cod'); // cash on delivery changes the delivery rate and adds a fee
  session.selectedPaymentMethod = method;
  if (repricing) await reprice(session);
  else await session.save();
  return toSessionDto(session);
}

export async function setWallet(customerId, id, use) {
  const session = await load(customerId, id);
  await assertOpen(session);
  session.useWallet = use;
  return toSessionDto(await reprice(session));
}

export async function revalidate(customerId, id) {
  const session = await load(customerId, id);
  await assertOpen(session);
  return toSessionDto(await reprice(session));
}

/**
 * Payment starts: prices once more, then holds the stock until the session expires and opens the Razorpay order
 * (for cash on delivery there is nothing to open: the order can be placed straight away).
 * If the total moved since the customer saw it, nothing is held or charged: CHECKOUT_CHANGED sends them back to review it.
 */
export async function createIntent(customerId, id, method) {
  const session = await load(customerId, id);
  if (method === 'cod' && session.status === SESSION_STATUS.OPEN && !isExpired(session)) {
    const agreed = await findCommittedPayment(session._id); // a double tap or retry gets the same cash-on-delivery payment, not 'already paid'
    if (agreed?.method === 'cod') return toPaymentDto(agreed);
  }
  await assertOpen(session);
  const shown = session.quote.totals.payablePaise;
  session.selectedPaymentMethod = method; // priced for the way it will be paid
  await reprice(session);
  const { quote } = session;
  if (!(await allowedMethods(quote)).includes(method)) throw failure(409, 'PAYMENT_METHOD_UNAVAILABLE', 'Choose another payment method.');
  if (quote.blockers.length) throw failure(409, 'CHECKOUT_BLOCKED', quote.blockers[0], { blockers: quote.blockers });
  if (quote.totals.payablePaise !== shown) throw failure(409, 'CHECKOUT_CHANGED', 'The price of your order changed. Review it before paying.', { checkout: await toSessionDto(session) });
  if (method !== 'cod' && quote.totals.payablePaise < MIN_PAYMENT_PAISE) throw failure(409, 'PAYMENT_AMOUNT_TOO_LOW', 'This order total is too small to pay online.');

  await holdStock({
    reference: stockReference(session),
    customerId,
    lines: session.items.map((item) => ({ offerId: String(item.offerId), qty: item.quantity })),
    expiresAt: session.expiresAt,
  });
  if (method === 'cod') return toPaymentDto(await createCodPayment({ customerId, checkoutSessionId: session._id, amountPaise: quote.totals.payablePaise }));
  return toPaymentDto(await createPaymentIntent({ customerId, checkoutSessionId: session._id, method, amountPaise: quote.totals.payablePaise }));
}
