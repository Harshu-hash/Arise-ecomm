import { io } from 'socket.io-client';
import { ENV } from '../../configs/env.config';
import { baseApi } from '../api/baseApi';

// Everything a shopper browses that admins/sellers can change. Refetching these is cheap: only screens
// currently on display refetch; the rest just get marked stale.
const CATALOG_TAGS = ['Home', 'Category', 'Product', 'Search', 'Brand', 'Coupon'];
const DEBOUNCE_MS = 400;

/**
 * Listens for the backend's "catalog changed" hint (an admin approved a product, set a flash sale, edited a
 * banner, ...) and refetches what is on screen, so changes appear without restarting the app. Missed hints are
 * not replayed, so every (re)connect refetches too. No-op against the mock API or without a socket URL.
 * Returns a stop function.
 */
export function startCatalogUpdates(dispatch) {
  if (ENV.enableApiMocks || !ENV.socketUrl) return () => {};
  let timer = null;
  const refetch = () => {
    clearTimeout(timer);
    timer = setTimeout(() => dispatch(baseApi.util.invalidateTags(CATALOG_TAGS)), DEBOUNCE_MS);
  };
  // No token: the public room is all a catalog listener needs, and it never expires.
  const socket = io(ENV.socketUrl, { transports: ['websocket'], reconnectionDelayMax: 10_000 });
  socket.on('catalog:changed', refetch);
  socket.on('session:ready', (() => {
    let first = true;
    return () => {
      if (first) first = false; // the first connect follows the app's own initial fetch
      else refetch();
    };
  })());
  return () => {
    clearTimeout(timer);
    socket.disconnect();
  };
}
