import { AxiosError } from 'axios';
import { getProductCardFixture } from './customerSearchProductAdapter';

const LATENCY_MS = 250;
const coupons = [
  {
    code: 'FLAT50',
    description: 'Flat ₹50 off on orders above ₹500',
    discountPaise: 5000,
    minimumSubtotalPaise: 50000,
  },
  {
    code: 'WELCOME10',
    description: '₹150 off for new customers',
    discountPaise: 15000,
    minimumSubtotalPaise: 30000,
  },
  { code: 'SAVE20', description: 'Flat ₹20 off', discountPaise: 2000, minimumSubtotalPaise: 0 },
];
let version = 1;
let appliedCouponCode = null;
let cartItems = [];
let savedItems = [];

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
const createItem = (productId, variantId = 'standard', variantLabel = 'Standard') => {
  const product = getProductCardFixture(productId);
  if (!product) return null;
  return {
    ...product,
    cartItemId: `cart-${productId}-${variantId}`,
    productId,
    variantId,
    variantLabel,
    offerId: `offer-${productId}`,
    sellerId: 'seller-arise-select',
    sellerName: 'Arise Select',
    quantity: 1,
    minimumQuantity: 1,
    maximumQuantity: 10,
    available: true,
    issueCode: null,
  };
};
const bump = () => {
  version += 1;
};
const subtotalPaise = () =>
  cartItems.reduce((total, item) => total + item.pricePaise * item.quantity, 0);
const cartEnvelope = () => {
  const subtotal = subtotalPaise();
  const mrp = cartItems.reduce((total, item) => total + item.mrpPaise * item.quantity, 0);
  const coupon = coupons.find(item => item.code === appliedCouponCode) ?? null;
  const couponDiscount = coupon ? Math.min(coupon.discountPaise, subtotal) : 0;
  const deliveryFee = cartItems.length ? 900 : 0;
  const platformFee = 0;
  const issues = cartItems
    .filter(item => !item.available || item.issueCode)
    .map(item => ({
      code: item.issueCode || 'PRODUCT_OUT_OF_STOCK',
      message: 'Resolve this item before checkout.',
      cartItemId: item.cartItemId,
      blocking: true,
    }));
  return {
    data: {
      id: 'cart-current',
      version,
      items: cartItems,
      savedItems,
      appliedCoupon: coupon,
      totals: {
        mrpPaise: mrp,
        subtotalPaise: subtotal,
        productDiscountPaise: Math.max(mrp - subtotal, 0),
        couponDiscountPaise: couponDiscount,
        deliveryFeePaise: deliveryFee,
        platformFeePaise: platformFee,
        payablePaise: Math.max(subtotal + deliveryFee + platformFee - couponDiscount, 0),
      },
      checkoutAllowed: cartItems.length > 0 && issues.length === 0,
      issues,
    },
  };
};

export const addCartProductFixture = (productId, variantId, variantLabel) => {
  const item = createItem(productId, variantId, variantLabel);
  if (!item) return null;
  const existing = cartItems.find(entry => entry.cartItemId === item.cartItemId);
  if (existing) existing.quantity = Math.min(existing.quantity + 1, existing.maximumQuantity);
  else cartItems.push(item);
  savedItems = savedItems.filter(entry => entry.cartItemId !== item.cartItemId);
  appliedCouponCode = null;
  bump();
  return item;
};

export const resetCustomerCartFixture = () => {
  version = 1;
  appliedCouponCode = null;
  cartItems = [createItem('h2', 'standard', 'Multicolour')];
  savedItems = [];
};
resetCustomerCartFixture();

export const customerCartFixtureAdapter = async config => {
  await wait();
  if (config.url === '/cart' && config.method === 'get') return response(config, cartEnvelope());
  if (config.url === '/cart/items' && config.method === 'post') {
    const item = addCartProductFixture(
      config.data?.productId,
      config.data?.variantId,
      config.data?.variantLabel,
    );
    if (!item) return reject(config, 404, 'PRODUCT_NOT_FOUND', 'This product is unavailable.');
    return response(config, cartEnvelope(), 201);
  }
  const itemMatch = config.url?.match(/^\/cart\/items\/([^/]+)$/);
  if (itemMatch && config.method === 'patch') {
    const cartItemId = decodeURIComponent(itemMatch[1]);
    const item = cartItems.find(entry => entry.cartItemId === cartItemId);
    if (!item)
      return reject(config, 404, 'CART_ITEM_NOT_FOUND', 'This cart item no longer exists.');
    const quantity = Number(config.data?.quantity);
    if (
      !Number.isInteger(quantity) ||
      quantity < item.minimumQuantity ||
      quantity > item.maximumQuantity
    ) {
      return reject(
        config,
        409,
        'QUANTITY_UNAVAILABLE',
        `Choose between ${item.minimumQuantity} and ${item.maximumQuantity}.`,
      );
    }
    item.quantity = quantity;
    appliedCouponCode = null;
    bump();
    return response(config, cartEnvelope());
  }
  if (itemMatch && config.method === 'delete') {
    const cartItemId = decodeURIComponent(itemMatch[1]);
    cartItems = cartItems.filter(item => item.cartItemId !== cartItemId);
    appliedCouponCode = null;
    bump();
    return response(config, cartEnvelope());
  }
  const saveMatch = config.url?.match(/^\/cart\/items\/([^/]+)\/save-for-later$/);
  if (saveMatch && config.method === 'post') {
    const cartItemId = decodeURIComponent(saveMatch[1]);
    const item = cartItems.find(entry => entry.cartItemId === cartItemId);
    if (!item)
      return reject(config, 404, 'CART_ITEM_NOT_FOUND', 'This cart item no longer exists.');
    cartItems = cartItems.filter(entry => entry.cartItemId !== cartItemId);
    savedItems.push(item);
    appliedCouponCode = null;
    bump();
    return response(config, cartEnvelope());
  }
  const moveMatch = config.url?.match(/^\/cart\/saved\/([^/]+)\/move-to-cart$/);
  if (moveMatch && config.method === 'post') {
    const cartItemId = decodeURIComponent(moveMatch[1]);
    const item = savedItems.find(entry => entry.cartItemId === cartItemId);
    if (!item)
      return reject(config, 404, 'SAVED_ITEM_NOT_FOUND', 'This saved item no longer exists.');
    savedItems = savedItems.filter(entry => entry.cartItemId !== cartItemId);
    cartItems.push(item);
    bump();
    return response(config, cartEnvelope());
  }
  if (config.url === '/coupons/eligible' && config.method === 'get') {
    return response(config, { data: { items: coupons } });
  }
  if (config.url === '/cart/coupon' && config.method === 'post') {
    const code = String(config.data?.code || '')
      .trim()
      .toUpperCase();
    const coupon = coupons.find(item => item.code === code);
    if (!coupon) return reject(config, 422, 'COUPON_INVALID', 'This coupon code is invalid.');
    if (subtotalPaise() < coupon.minimumSubtotalPaise) {
      return reject(
        config,
        409,
        'COUPON_MINIMUM_NOT_MET',
        'Add more eligible items to use this coupon.',
      );
    }
    appliedCouponCode = code;
    bump();
    return response(config, cartEnvelope());
  }
  if (config.url === '/cart/coupon' && config.method === 'delete') {
    appliedCouponCode = null;
    bump();
    return response(config, cartEnvelope());
  }
  return reject(
    config,
    501,
    'FIXTURE_NOT_IMPLEMENTED',
    `No fixture exists for ${config.method?.toUpperCase()} ${config.url}.`,
  );
};

export const createCartFixtureEnvelope = cartEnvelope;
export const completeCartFixture = () => {
  cartItems = [];
  appliedCouponCode = null;
  bump();
};
