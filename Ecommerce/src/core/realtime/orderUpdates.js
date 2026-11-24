import { io } from 'socket.io-client';
import { ENV } from '../../configs/env.config';
import { baseApi } from '../api/baseApi';

// Live chat's typing hint is not a refetch signal, so screens listen to it directly through these.
let activeSocket = null;
const typingListeners = new Set();
export const onSupportTyping = listener => {
  typingListeners.add(listener);
  return () => typingListeners.delete(listener);
};
export const emitCustomerTyping = () => activeSocket?.emit('chat:typing');

/**
 * While a customer is signed in, listens for the backend's "your order changed" hint and refetches what is on screen, so a
 * status moves the moment the seller or courier acts, without pulling to refresh. The hint is only a nudge: the screen then
 * reads the committed order over HTTP. Missed hints are not replayed, so every (re)connect refetches too.
 * `getToken` is read on each (re)connect so a refreshed access token is used. No-op against the mock API or without a socket URL.
 * Returns a stop function.
 */
export function startOrderUpdates(dispatch, getToken) {
  if (ENV.enableApiMocks || !ENV.socketUrl) return () => {};
  const socket = io(ENV.socketUrl, {
    transports: ['websocket'],
    reconnectionDelayMax: 10_000,
    auth: done => done({ token: getToken() }),
  });
  const refetchOrders = hint => {
    const tags = [{ type: 'Order', id: 'LIST' }];
    if (hint?.orderId) tags.push({ type: 'Order', id: hint.orderId }, { type: 'Shipment', id: hint.orderId });
    dispatch(baseApi.util.invalidateTags(tags));
  };
  // a return moved: its screen, the returns list and the order it belongs to refetch
  const refetchReturns = hint => {
    const tags = [{ type: 'Return', id: 'LIST' }, { type: 'Order', id: 'LIST' }];
    if (hint?.returnId) tags.push({ type: 'Return', id: hint.returnId });
    if (hint?.orderId) tags.push({ type: 'Order', id: hint.orderId }, { type: 'Return', id: `ELIGIBILITY-${hint.orderId}` });
    dispatch(baseApi.util.invalidateTags(tags));
  };
  const refetchNotifications = () => dispatch(baseApi.util.invalidateTags([{ type: 'Notification', id: 'LIST' }]));
  const refetchChat = () => dispatch(baseApi.util.invalidateTags([{ type: 'Chat' }]));
  socket.on('order:changed', refetchOrders);
  socket.on('chat:changed', refetchChat);
  socket.on('chat:typing', () => typingListeners.forEach(listener => listener()));
  activeSocket = socket;
  socket.on('return:changed', refetchReturns);
  socket.on('notification:changed', refetchNotifications);
  socket.on('session:ready', () => {
    refetchOrders();
    refetchReturns();
    refetchNotifications();
    refetchChat();
  });
  return () => {
    activeSocket = null;
    socket.disconnect();
  };
}
