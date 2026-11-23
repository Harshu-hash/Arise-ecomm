import { emitTo, rooms } from './socket.js';

/**
 * An order's status just changed (placed, accepted, shipped, cancelled, ...): tell the three places that show it, right away.
 * Customer app (their own room), each seller in the order (their rooms) and every open admin console. The hint carries no
 * detail beyond the order's id and status: screens refetch the committed truth over HTTP, and refetch again on reconnect,
 * so a missed or reordered hint can never leave a screen wrong. Call it after the change is committed.
 */
export function orderChanged(order) {
  const hint = { orderId: String(order._id), status: order.status, at: new Date().toISOString() };
  emitTo(rooms.user(order.customerId), 'order:changed', hint);
  for (const sellerId of new Set(order.subOrders.map((sub) => sub.sellerId))) emitTo(rooms.seller(sellerId), 'order:changed', hint);
  emitTo(rooms.admin, 'order:changed', hint);
}

/** A new notification row exists for this customer or seller: their bell and list should refetch. */
export const notificationChanged = (type, id) => emitTo(type === 'CUSTOMER' ? rooms.user(id) : rooms.seller(id), 'notification:changed', { at: new Date().toISOString() });

/** A return moved: the customer's return screens, the seller's and every open admin console refetch it (same hint-then-refetch as orders). */
export function returnChanged(ret) {
  const hint = { returnId: String(ret._id), orderId: String(ret.orderId), status: ret.status, at: new Date().toISOString() };
  emitTo(rooms.user(ret.customerId), 'return:changed', hint);
  emitTo(rooms.seller(ret.sellerId), 'return:changed', hint);
  emitTo(rooms.admin, 'return:changed', hint);
}
