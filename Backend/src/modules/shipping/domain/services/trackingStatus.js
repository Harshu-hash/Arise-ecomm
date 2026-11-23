// How a courier's progress reads on our side. Pure.

export const SHIPMENT_STATUS = Object.freeze({
  READY_TO_SHIP: 'READY_TO_SHIP', // label and tracking number exist; the courier has not collected it yet
  SHIPPED: 'SHIPPED', // collected from the seller
  IN_TRANSIT: 'IN_TRANSIT',
  OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
  DELIVERY_FAILED: 'DELIVERY_FAILED', // an attempt failed; the courier may try again
  DELIVERED: 'DELIVERED',
  RTO: 'RTO', // on its way back to the seller
  RTO_DELIVERED: 'RTO_DELIVERED', // back with the seller
});

// Shiprocket's `current_status` words (upper-cased) -> ours. Anything not listed is recorded but moves nothing.
const FROM_SHIPROCKET = {
  'PICKED UP': 'SHIPPED',
  SHIPPED: 'SHIPPED',
  'IN TRANSIT': 'IN_TRANSIT',
  'REACHED AT DESTINATION HUB': 'IN_TRANSIT',
  'MISROUTED': 'IN_TRANSIT',
  'OUT FOR DELIVERY': 'OUT_FOR_DELIVERY',
  UNDELIVERED: 'DELIVERY_FAILED',
  DELIVERED: 'DELIVERED',
  'RTO INITIATED': 'RTO',
  'RTO IN TRANSIT': 'RTO',
  'RTO DELIVERED': 'RTO_DELIVERED',
  'RTO OFD': 'RTO',
};

export const mapShiprocketStatus = (providerStatus) => FROM_SHIPROCKET[String(providerStatus ?? '').trim().toUpperCase()] ?? null;

const RANK = { CONFIRMED: -2, ACCEPTED: -1, READY_TO_SHIP: 0, SHIPPED: 1, IN_TRANSIT: 2, OUT_FOR_DELIVERY: 3, DELIVERY_FAILED: 3, DELIVERED: 4, RTO: 5, RTO_DELIVERED: 6 };

/**
 * Whether a courier update may move a shipment from `current` to `next`. Updates arrive late and out of order, so progress
 * never goes backwards; a delivered parcel stays delivered; a parcel can go from a failed attempt back out for delivery.
 */
export function canAdvance(current, next) {
  if (!next || current === next) return false;
  if (current === 'DELIVERED') return false;
  if (current === 'RTO_DELIVERED') return false;
  return RANK[next] >= RANK[current];
}
