// Status rules for orders and the seller parcels (sub-orders) inside them. Pure.

export const SUB = Object.freeze({
  CONFIRMED: 'CONFIRMED', // paid and placed; the seller has not accepted yet
  ACCEPTED: 'ACCEPTED',
  READY_TO_SHIP: 'READY_TO_SHIP', // parcel exists on Shiprocket with a label; the courier will collect it
  SHIPPED: 'SHIPPED',
  IN_TRANSIT: 'IN_TRANSIT',
  OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
  DELIVERY_FAILED: 'DELIVERY_FAILED',
  DELIVERED: 'DELIVERED',
  RTO: 'RTO', // coming back to the seller
  RTO_DELIVERED: 'RTO_DELIVERED', // back with the seller: stock restored and the items refunded
  CANCELLED: 'CANCELLED',
});

const RANK = { CONFIRMED: 0, ACCEPTED: 1, READY_TO_SHIP: 2, SHIPPED: 3, IN_TRANSIT: 4, OUT_FOR_DELIVERY: 5, DELIVERY_FAILED: 5, DELIVERED: 6, RTO: 6, RTO_DELIVERED: 7 };

// What the customer's app calls each stage (its OrderStatus list).
const CUSTOMER_STATUS = {
  CONFIRMED: 'CONFIRMED', ACCEPTED: 'PROCESSING', READY_TO_SHIP: 'READY_TO_SHIP', SHIPPED: 'SHIPPED', IN_TRANSIT: 'IN_TRANSIT',
  OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY', DELIVERY_FAILED: 'DELIVERY_FAILED', DELIVERED: 'DELIVERED', RTO: 'DELIVERY_FAILED',
};

/** The order is as far along as its slowest live parcel; cancelled and returned-to-seller parcels do not hold it back. None left = CANCELLED. */
export function deriveOrderStatus(subStatuses) {
  const live = subStatuses.filter((status) => status !== SUB.CANCELLED && status !== SUB.RTO_DELIVERED);
  if (!live.length) return 'CANCELLED';
  return CUSTOMER_STATUS[live.reduce((slowest, status) => (RANK[status] < RANK[slowest] ? status : slowest))];
}

/** A parcel can be cancelled until the seller has made it ready to ship. */
export const isCancellable = (status) => status === SUB.CONFIRMED || status === SUB.ACCEPTED;

/** The seller's order tabs. */
export const STAGES = Object.freeze({
  NEW: [SUB.CONFIRMED],
  PROCESSING: [SUB.ACCEPTED, SUB.READY_TO_SHIP],
  SHIPPED: [SUB.SHIPPED, SUB.IN_TRANSIT, SUB.OUT_FOR_DELIVERY, SUB.DELIVERY_FAILED],
  DELIVERED: [SUB.DELIVERED],
  RTO: [SUB.RTO, SUB.RTO_DELIVERED],
  CANCELLED: [SUB.CANCELLED],
});

export const stageOf = (status) => Object.entries(STAGES).find(([, statuses]) => statuses.includes(status))?.[0] ?? 'OTHER';

/** The one thing the seller can do next, named as the panel's button. */
export const nextActionOf = (status) => ({ [SUB.CONFIRMED]: 'confirm', [SUB.ACCEPTED]: 'ready-to-ship' })[status] ?? null;

/** Seller steps: from which status each action may start. */
export const SELLER_ACTIONS = Object.freeze({ confirm: [SUB.CONFIRMED], 'ready-to-ship': [SUB.ACCEPTED] });

/** When the parcel was delivered: the stored time, or (parcels delivered before it was stored) its last DELIVERED event. */
export const deliveredAtOf = (sub) => sub.deliveredAt ?? sub.events.findLast((event) => event.status === SUB.DELIVERED)?.at ?? null;

/** Last moment the customer may return `item`, or null when it was not delivered or its policy allows no returns (including orders placed before the policy was stored). */
export function returnWindowEndsAt(sub, item) {
  const deliveredAt = deliveredAtOf(sub);
  return deliveredAt && item.returnWindowDays > 0 ? new Date(deliveredAt.getTime() + item.returnWindowDays * 86_400_000) : null;
}

/** Cash on delivery is collected once every parcel still going to the customer has been delivered (the courier takes the cash then). */
export const isCodCollected = (order) => {
  const live = order.subOrders.filter((sub) => ![SUB.CANCELLED, SUB.RTO_DELIVERED].includes(sub.status));
  return live.length > 0 && live.every((sub) => sub.deliveredAt);
};
