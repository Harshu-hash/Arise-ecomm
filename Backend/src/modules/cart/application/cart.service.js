import mongoose from 'mongoose';
import { AppError } from '../../../shared/errors/AppError.js';
import { getSettingsSection } from '../../admin/public/index.js';
import { evaluateCouponsForCart } from '../../coupon/public/index.js';
import { pickOfferId } from '../../product/public/index.js';
import { MAX_CART_LINES } from '../domain/constants/cart.js';
import { computeTotals, couponSaving } from '../domain/services/cartRules.js';
import { Cart } from '../infrastructure/persistence/cart.model.js';
import { LINE_ISSUE, resolveLines } from './lineResolver.service.js';

// The customer's cart. Only their choices are stored (which offers, how many, saved for later, a coupon code); every read
// prices the lines again through resolveLines, the same check checkout uses, so the cart shows what would really happen.
// A change is priced and checked before it is saved, so a rejected change leaves the cart exactly as it was.

const MAX_WRITE_ATTEMPTS = 5;
const failure = (status, code, message, details = null, retryable = false) => new AppError({ code, message, status, details, retryable });
const productNotFound = () => failure(404, 'PRODUCT_NOT_FOUND', 'This product is unavailable.');
const itemNotFound = () => failure(404, 'CART_ITEM_NOT_FOUND', 'This cart item no longer exists.');
const savedNotFound = () => failure(404, 'SAVED_ITEM_NOT_FOUND', 'This saved item no longer exists.');

const known = (line) => line.name !== undefined; // an offer that is gone resolves to a bare verdict: show it from the snapshot
const snapshotOf = (line) => ({
  productId: line.productId, variantId: line.variantId, name: line.name, brand: line.brand, category: line.category,
  imageUrl: line.imageUrl, variantLabel: line.variantLabel, sellerId: line.sellerId, sellerName: line.sellerName,
  mrpPaise: line.mrpPaise, unitPricePaise: line.unitPricePaise,
});

/* ------------------------------------------------------------------ pricing and the customer-facing view */

const ISSUE_MESSAGE = {
  [LINE_ISSUE.OFFER_UNAVAILABLE]: (name) => `${name} is no longer available.`,
  [LINE_ISSUE.SELLER_UNAVAILABLE]: (name) => `${name} cannot be ordered from this seller right now.`,
  [LINE_ISSUE.OUT_OF_STOCK]: (name) => `${name} is out of stock.`,
  [LINE_ISSUE.QUANTITY_LIMIT]: (name, line) => `Only ${line.maximumQuantity} of ${name} can be bought at once.`,
};
const rupees = (paise) => `₹${(paise / 100).toLocaleString('en-IN')}`;

/** Why a coupon cannot be used on this cart, as the error the customer sees. */
function couponProblem(found, buyable) {
  if (!buyable.length) return { status: 409, code: 'COUPON_NOT_APPLICABLE', message: 'Add an item to your cart to use a coupon.' };
  if (!found) return { status: 422, code: 'COUPON_INVALID', message: 'This coupon code is invalid.' };
  if (found.belowMinimum) {
    return { status: 409, code: 'COUPON_MINIMUM_NOT_MET', message: `Add more eligible items to reach ${rupees(found.minimumSubtotalPaise)} and use this coupon.`, details: { minimumSubtotalPaise: found.minimumSubtotalPaise } };
  }
  return { status: 409, code: 'COUPON_NOT_APPLICABLE', message: found.reasons[0] ?? 'This coupon cannot be used on this cart.' };
}

/** Prices every line and judges the coupon. `items` are the cart's stored lines (cart and saved), in any order. */
async function assemble(customerId, items, couponCode) {
  const [resolved, fees] = await Promise.all([
    resolveLines(items.map((item) => ({ offerId: String(item.offerId), quantity: item.quantity }))),
    getSettingsSection('fees'),
  ]);
  const rows = items.map((item, index) => ({ item, line: resolved[index] }));
  const active = rows.filter(({ item }) => !item.savedForLater);
  const buyable = active.filter(({ line }) => line.sellable); // lines with a problem are not charged for; they block checkout instead
  const lines = buyable.map(({ line }) => line);

  let coupon = null;
  let problem = null;
  if (couponCode) {
    const [found] = lines.length ? await evaluateCouponsForCart(customerId, lines, { code: couponCode }) : [];
    if (found?.applicable && computeTotals(lines, { coupon: found, fees }).couponDiscountPaise > 0) coupon = found;
    else problem = found?.applicable ? { status: 409, code: 'COUPON_NOT_APPLICABLE', message: 'This coupon would not save anything on this cart.' } : couponProblem(found, lines);
  }
  return { rows, active, buyable, lines, fees, coupon, problem };
}

function toItem({ item, line }) {
  const live = known(line);
  const saw = item.snapshot ?? {};
  const issueCode = line.issueCode;
  return {
    id: live ? line.productId : saw.productId,
    name: live ? line.name : saw.name,
    brand: live ? line.brand : saw.brand ?? '',
    category: live ? line.category : saw.category ?? '',
    imageUrl: live ? line.imageUrl : saw.imageUrl,
    pricePaise: live ? line.unitPricePaise : saw.unitPricePaise,
    mrpPaise: Math.max(live ? line.mrpPaise : saw.mrpPaise, 1),
    rating: null, // no reviews module yet
    ratingCount: 0,
    assured: live ? Boolean(line.assured) : false,
    deliveryLabel: null,
    cartItemId: String(item._id),
    productId: live ? line.productId : saw.productId,
    variantId: live ? line.variantId : saw.variantId,
    variantLabel: live ? line.variantLabel : saw.variantLabel ?? 'Standard',
    offerId: String(item.offerId),
    sellerId: live ? line.sellerId : saw.sellerId,
    sellerName: live ? line.sellerName : saw.sellerName ?? 'Seller',
    quantity: item.quantity,
    minimumQuantity: 1,
    maximumQuantity: live ? Math.max(line.maximumQuantity, 1) : 1,
    available: ![LINE_ISSUE.OFFER_UNAVAILABLE, LINE_ISSUE.SELLER_UNAVAILABLE, LINE_ISSUE.OUT_OF_STOCK].includes(issueCode),
    issueCode,
  };
}

function toView(customerId, version, ctx, notices = []) {
  const { rows, active, buyable, lines, fees, coupon } = ctx;
  const totals = computeTotals(lines, { coupon, fees });
  const issues = [
    ...active.filter(({ line }) => !line.sellable).map((row) => ({
      code: row.line.issueCode,
      message: ISSUE_MESSAGE[row.line.issueCode](known(row.line) ? row.line.name : row.item.snapshot?.name ?? 'This item', row.line),
      cartItemId: String(row.item._id),
      blocking: true,
    })),
    ...buyable
      .filter(({ item, line }) => item.snapshot && item.snapshot.unitPricePaise !== line.unitPricePaise)
      .map(({ item, line }) => ({
        code: 'PRICE_CHANGED',
        message: `The price of ${line.name} changed from ${rupees(item.snapshot.unitPricePaise)} to ${rupees(line.unitPricePaise)}.`,
        cartItemId: String(item._id),
        blocking: false,
      })),
    ...notices,
  ];
  return {
    id: customerId,
    version,
    items: active.map(toItem),
    savedItems: rows.filter(({ item }) => item.savedForLater).map(toItem),
    appliedCoupon: coupon
      ? { code: coupon.code, description: coupon.description, discountPaise: totals.couponDiscountPaise, minimumSubtotalPaise: coupon.minimumSubtotalPaise }
      : null,
    totals,
    checkoutAllowed: lines.length > 0 && issues.every((issue) => !issue.blocking),
    issues,
  };
}

/* --------------------------------------------------------------------------------------------- storage */

const emptyCart = (customerId) => ({ customerId, items: [], couponCode: null, version: 0 });
const load = async (customerId) => (await Cart.findOne({ customerId }).lean()) ?? emptyCart(customerId);

// Saves only if nobody changed the cart since it was read; returns the new version, or null when it was changed.
async function persist(cart, items, couponCode) {
  if (!cart._id) {
    if (!items.length) return 0; // nothing to remember for a customer with no cart
    try {
      await Cart.create({ customerId: cart.customerId, items, couponCode, version: 1 });
      return 1;
    } catch (error) {
      if (error?.code === 11000) return null; // their other device created it a moment ago
      throw error;
    }
  }
  const { modifiedCount } = await Cart.updateOne({ _id: cart._id, version: cart.version }, { $set: { items, couponCode }, $inc: { version: 1 } });
  return modifiedCount ? cart.version + 1 : null;
}

/**
 * Runs one change: `change(cart)` returns the new state ({ items, couponCode?, targetId?, check?, strictCoupon? }). It is
 * priced, checked, and saved only if valid, then the cart is returned as the customer should see it. A coupon that stopped
 * applying because of the change is dropped with a notice; with `strictCoupon` (applying one) it is an error instead.
 */
async function mutate(customerId, change) {
  for (let attempt = 0; attempt < MAX_WRITE_ATTEMPTS; attempt += 1) {
    const cart = await load(customerId);
    const plan = await change(cart);
    const couponCode = plan.couponCode === undefined ? cart.couponCode : plan.couponCode;
    const ctx = await assemble(customerId, plan.items, couponCode);
    plan.check?.(ctx);
    const notices = [];
    let keep = couponCode;
    if (couponCode && !ctx.coupon) {
      if (plan.strictCoupon) throw failure(ctx.problem.status, ctx.problem.code, ctx.problem.message, ctx.problem.details);
      keep = null;
      notices.push({ code: 'COUPON_REMOVED', message: `${couponCode} no longer applies: ${ctx.problem.message}`, cartItemId: null, blocking: false });
    }
    // The saved snapshot is refreshed after the view was judged against the old one, so a price change is shown once.
    const stored = ctx.rows.map(({ item, line }) => (known(line) ? { ...item, snapshot: snapshotOf(line) } : item));
    const version = await persist(cart, stored, keep);
    if (version === null) continue; // changed under us: start again from what is there now
    return { view: toView(customerId, version, ctx, notices), cartItemId: plan.targetId ?? null };
  }
  throw failure(409, 'CART_BUSY', 'Your cart is being changed elsewhere. Try again.', null, true);
}

/* ------------------------------------------------------------------------------------------- commands */

function assertBuyable(line) {
  if (line.issueCode === null) return;
  if (line.issueCode === LINE_ISSUE.OFFER_UNAVAILABLE) throw productNotFound();
  if (line.issueCode === LINE_ISSUE.SELLER_UNAVAILABLE) throw failure(409, 'PRODUCT_UNAVAILABLE', 'This seller is not taking orders right now.');
  if (line.issueCode === LINE_ISSUE.OUT_OF_STOCK) throw failure(409, 'PRODUCT_OUT_OF_STOCK', 'This product is currently out of stock.');
  throw failure(409, 'QUANTITY_UNAVAILABLE', `You can buy at most ${line.maximumQuantity} of this item.`, { maximumQuantity: line.maximumQuantity });
}
const plain = (items) => items.map((item) => ({ ...item }));
const targetCheck = (target) => (ctx) => assertBuyable(ctx.rows.find(({ item }) => item === target).line);

export const getCart = async (customerId) => {
  const cart = await load(customerId);
  const ctx = await assemble(customerId, cart.items, cart.couponCode);
  const notices = cart.couponCode && !ctx.coupon ? [{ code: 'COUPON_NOT_APPLICABLE', message: `${cart.couponCode} no longer applies: ${ctx.problem.message}`, cartItemId: null, blocking: false }] : [];
  return toView(customerId, cart.version, ctx, notices);
};

/** Adds `quantity` of an offer (or of a product's variant, picking the seller) and returns { view, cartItemId }. */
export const addItem = (customerId, { offerId = null, productId = null, variantId = null, quantity }) => mutate(customerId, async (cart) => {
  const chosen = offerId ?? (await pickOfferId({ productId, variantId }));
  if (!chosen) throw productNotFound();
  const items = plain(cart.items);
  const existing = items.find((item) => String(item.offerId) === String(chosen));
  if (!existing && items.length >= MAX_CART_LINES) throw failure(409, 'CART_FULL', `A cart holds at most ${MAX_CART_LINES} different items.`);
  let target = existing;
  if (existing) {
    existing.quantity = (existing.savedForLater ? 0 : existing.quantity) + quantity; // adding a saved item brings it back to the cart
    existing.savedForLater = false;
  } else {
    target = { _id: new mongoose.Types.ObjectId(), offerId: chosen, quantity, savedForLater: false, addedAt: new Date() };
    items.push(target);
  }
  return { items, targetId: String(target._id), check: targetCheck(target) };
});

export const setQuantity = (customerId, cartItemId, quantity) => mutate(customerId, async (cart) => {
  const items = plain(cart.items);
  const target = items.find((item) => String(item._id) === cartItemId && !item.savedForLater);
  if (!target) throw itemNotFound();
  target.quantity = quantity;
  return { items, targetId: cartItemId, check: targetCheck(target) };
});

/** Removing something that is not there succeeds too. */
export const removeItem = (customerId, cartItemId) => mutate(customerId, async (cart) => ({
  items: plain(cart.items).filter((item) => String(item._id) !== cartItemId),
}));

export const saveForLater = (customerId, cartItemId) => mutate(customerId, async (cart) => {
  const items = plain(cart.items);
  const target = items.find((item) => String(item._id) === cartItemId && !item.savedForLater);
  if (!target) throw itemNotFound();
  target.savedForLater = true;
  return { items };
});

export const moveToCart = (customerId, cartItemId) => mutate(customerId, async (cart) => {
  const items = plain(cart.items);
  const target = items.find((item) => String(item._id) === cartItemId && item.savedForLater);
  if (!target) throw savedNotFound();
  target.savedForLater = false;
  return { items, targetId: cartItemId, check: targetCheck(target) };
});

export const applyCoupon = (customerId, code) => mutate(customerId, async (cart) => ({
  items: plain(cart.items), couponCode: code.trim().toUpperCase(), strictCoupon: true,
}));

export const removeCoupon = (customerId) => mutate(customerId, async (cart) => ({ items: plain(cart.items), couponCode: null }));

/** The coupons that would save something on this cart right now, best first: { code, description, discountPaise, minimumSubtotalPaise }. */
export async function listEligibleCoupons(customerId) {
  const cart = await load(customerId);
  const ctx = await assemble(customerId, cart.items, null);
  if (!ctx.lines.length) return [];
  const { subtotalPaise, deliveryFeePaise } = computeTotals(ctx.lines, { fees: ctx.fees });
  return (await evaluateCouponsForCart(customerId, ctx.lines))
    .filter((coupon) => coupon.applicable)
    .map((coupon) => ({ code: coupon.code, description: coupon.description, discountPaise: couponSaving(coupon, { subtotalPaise, deliveryFeePaise }), minimumSubtotalPaise: coupon.minimumSubtotalPaise }))
    .filter((coupon) => coupon.discountPaise > 0)
    .sort((a, b) => b.discountPaise - a.discountPaise);
}

/** For the wishlist: one of the product, from the cheapest seller. Returns { cartItemId, cart }. */
export async function addProductToCart(customerId, productId) {
  const { view, cartItemId } = await addItem(customerId, { productId, quantity: 1 });
  return { cartItemId, cart: view };
}

export const deleteCustomerCart = (customerId) => Cart.deleteOne({ customerId: String(customerId) });

/** After an order: takes the ordered offers out of the cart (saved-for-later items stay) and drops the coupon that was used. */
export const removeOrderedItems = (customerId, offerIds) => Cart.updateOne(
  { customerId: String(customerId) },
  { $pull: { items: { offerId: { $in: offerIds }, savedForLater: false } }, $set: { couponCode: null }, $inc: { version: 1 } },
);
