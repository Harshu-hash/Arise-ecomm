import { AxiosError } from 'axios';
import { getProductCardFixture } from './customerSearchProductAdapter';
import { addCartProductFixture } from './customerCartAdapter';

const LATENCY_MS = 250;
const INITIAL_PRODUCT_IDS = ['e1', 'm1', 'h2', 'e6', 'f1'];
let wishlistProductIds = [...INITIAL_PRODUCT_IDS];

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
const isAvailable = productId => productId !== 'e6';
const wishlistEnvelope = () => {
  const items = wishlistProductIds
    .map((productId, index) => {
      const product = getProductCardFixture(productId);
      return product
        ? {
            ...product,
            addedAt: new Date(Date.UTC(2026, 9, 1 + index)).toISOString(),
            available: isAvailable(productId),
          }
        : null;
    })
    .filter(Boolean);
  return { data: { items, total: items.length } };
};

export const resetCustomerWishlistFixture = () => {
  wishlistProductIds = [...INITIAL_PRODUCT_IDS];
};

export const customerWishlistFixtureAdapter = async config => {
  await wait();
  if (config.url === '/wishlist' && config.method === 'get') {
    return response(config, wishlistEnvelope());
  }
  if (config.url === '/wishlist/items' && config.method === 'post') {
    const productId = config.data?.productId;
    if (!getProductCardFixture(productId)) {
      return reject(config, 404, 'PRODUCT_NOT_FOUND', 'This product is unavailable.');
    }
    if (!wishlistProductIds.includes(productId)) wishlistProductIds.unshift(productId);
    return response(config, { data: { productId, wishlisted: true } }, 201);
  }
  if (config.url?.startsWith('/wishlist/items/') && config.method === 'delete') {
    const productId = decodeURIComponent(config.url.slice('/wishlist/items/'.length));
    wishlistProductIds = wishlistProductIds.filter(id => id !== productId);
    return response(config, { data: { productId, wishlisted: false } });
  }
  const moveMatch = config.url?.match(/^\/wishlist\/([^/]+)\/move-to-cart$/);
  if (moveMatch && config.method === 'post') {
    const productId = decodeURIComponent(moveMatch[1]);
    if (!wishlistProductIds.includes(productId)) {
      return reject(config, 404, 'WISHLIST_ITEM_NOT_FOUND', 'This item is no longer saved.');
    }
    if (!isAvailable(productId)) {
      return reject(config, 409, 'PRODUCT_OUT_OF_STOCK', 'This product is currently out of stock.');
    }
    const cartItem = addCartProductFixture(productId, 'standard', 'Standard');
    wishlistProductIds = wishlistProductIds.filter(id => id !== productId);
    return response(config, {
      data: { productId, wishlisted: false, cartItemId: cartItem.cartItemId },
    });
  }
  return reject(
    config,
    501,
    'FIXTURE_NOT_IMPLEMENTED',
    `No fixture exists for ${config.method?.toUpperCase()} ${config.url}.`,
  );
};

export const createWishlistFixtureEnvelope = wishlistEnvelope;
