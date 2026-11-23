import { createHash } from 'node:crypto';
import { logger } from '../../../config/logger.js';
import { shippingGateway } from '../../../infrastructure/external/shipping/index.js';
import { AppError } from '../../../shared/errors/AppError.js';
import { getSellerPickupProfile, setSellerPickupLocationName } from '../../identity/public/index.js';
import { getVariantShippingSpecs } from '../../product/public/index.js';
import { canAdvance, mapShiprocketStatus, SHIPMENT_STATUS } from '../domain/services/trackingStatus.js';
import { Shipment } from '../infrastructure/persistence/shipment.model.js';

const LOCK_MS = 90_000;
const DUPLICATE_KEY = 11000;
const failure = (status, code, message, retryable = false) => new AppError({ code, message, status, retryable });

/** What the pickup address needs before Shiprocket will take it. */
function missingPickupDetails(profile) {
  const { address, city, state, pincode } = profile.location;
  return Object.entries({ address, city, state, pincode, phone: profile.phone, email: profile.email }).filter(([, value]) => !value).map(([key]) => key);
}

/** Registers the seller's one pickup address on Shiprocket the first time it is needed; returns its name there. */
async function pickupNameFor(sellerId) {
  const profile = await getSellerPickupProfile(sellerId);
  if (!profile) throw failure(404, 'SELLER_NOT_FOUND', 'This seller does not exist.');
  const { address, city, state, pincode } = profile.location;
  // the name encodes the address: edit the address and the next shipment registers the new one instead of reusing the old
  const name = `arise-${String(sellerId).slice(-10)}-${createHash('sha1').update([address, city, state, pincode].join('|').toLowerCase()).digest('hex').slice(0, 6)}`;
  if (profile.pickupLocationName === name) return name;
  const missing = missingPickupDetails(profile);
  if (missing.length) throw failure(409, 'PICKUP_ADDRESS_INCOMPLETE', `Add your pickup ${missing.join(', ')} in your store settings before shipping.`);
  await shippingGateway.ensurePickupLocation({
    name, contactName: profile.contactName, email: profile.email, phone: profile.phone,
    address: profile.location.address, city: profile.location.city, state: profile.location.state, pincode: profile.location.pincode,
  });
  await setSellerPickupLocationName(sellerId, name);
  return name;
}

/** Weight is the sum, and the box is as long and wide as the biggest item and as tall as all of them stacked. */
export function packageOf(items, specs) {
  let weightG = 0;
  const dims = { l: 1, w: 1, h: 0 };
  for (const item of items) {
    const spec = specs.get(String(item.variantId)) ?? { weightG: 500, dimsCm: { l: 10, w: 10, h: 10 } };
    weightG += spec.weightG * item.quantity;
    dims.l = Math.max(dims.l, spec.dimsCm.l);
    dims.w = Math.max(dims.w, spec.dimsCm.w);
    dims.h += spec.dimsCm.h * item.quantity;
  }
  return { weightG, dimsCm: { ...dims, h: Math.max(dims.h, 1) } };
}

/**
 * The seller clicked "ready to ship": creates the parcel on Shiprocket, gets its tracking number and label, and asks the
 * courier to collect it. Every step is saved as it succeeds, so if one fails (low Shiprocket balance, a courier hiccup) the
 * seller can click again and it carries on from there; clicking twice at once or after it is done changes nothing.
 * `collectPaise`: what the courier must collect from the customer (cash on delivery), null when prepaid. `items` are { name, variantId, quantity, pricePaise }; `customer` is { name, phone, email, address, city, state, pincode }.
 */
export async function readyToShip({ orderId, subOrderId, sellerId, reference, placedAt, customer, items, collectPaise = null }) {
  await Shipment.create({ orderId, subOrderId, sellerId }).catch((error) => {
    if (error?.code !== DUPLICATE_KEY) throw error;
  });
  const now = new Date();
  const shipment = await Shipment.findOneAndUpdate(
    { subOrderId, $or: [{ lockedUntil: null }, { lockedUntil: { $lt: now } }] },
    { $set: { lockedUntil: new Date(now.getTime() + LOCK_MS) } },
    { new: true },
  );
  if (!shipment) throw failure(409, 'SHIPMENT_IN_PROGRESS', 'This parcel is already being prepared. Try again in a moment.', true);
  try {
    if (shipment.status !== 'CREATING') return shipment;
    shipment.pickupName ??= await pickupNameFor(sellerId);
    if (!shipment.providerShipmentId) {
      const specs = await getVariantShippingSpecs(items.map((item) => item.variantId));
      const { weightG, dimsCm } = packageOf(items, specs);
      const created = await shippingGateway.createShipment({
        reference,
        placedAt,
        pickupName: shipment.pickupName,
        customer,
        items: items.map((item) => ({ name: item.name, sku: specs.get(String(item.variantId))?.sku ?? String(item.variantId), units: item.quantity, pricePaise: item.pricePaise })),
        weightG,
        dimsCm,
        collectPaise,
      });
      shipment.shiprocketOrderId = created.shiprocketOrderId;
      shipment.providerShipmentId = created.shipmentId;
      await shipment.save();
    }
    if (!shipment.awb) {
      const { awb, courierName } = await shippingGateway.assignAwb(shipment.providerShipmentId);
      shipment.awb = awb;
      shipment.courierName = courierName;
      await shipment.save();
    }
    if (!shipment.labelUrl) {
      shipment.labelUrl = (await shippingGateway.generateLabel(shipment.providerShipmentId)).labelUrl;
      await shipment.save();
    }
    if (!shipment.pickupRequestedAt) {
      // The parcel already has its tracking number and label; a failed pickup request is retried by the courier's own schedule.
      await shippingGateway.requestPickup(shipment.providerShipmentId)
        .then(() => { shipment.pickupRequestedAt = new Date(); })
        .catch((err) => logger.warn({ err, subOrderId: String(subOrderId) }, 'Pickup request failed; the parcel is still ready to ship'));
    }
    shipment.status = SHIPMENT_STATUS.READY_TO_SHIP;
    shipment.events.push({ status: SHIPMENT_STATUS.READY_TO_SHIP, providerStatus: null, location: null, at: new Date() });
    return await shipment.save();
  } finally {
    await Shipment.updateOne({ _id: shipment._id }, { $set: { lockedUntil: null } });
  }
}

/**
 * TESTING ONLY: a parcel that looks ready to ship (made-up tracking number, "Mock Courier", no label) without touching
 * Shiprocket, so the order flow can be tried without a courier account. Callers must refuse to use it in production.
 * Courier progress can then be simulated by posting tracking updates for the returned `awb` to the tracking webhook.
 */
export async function mockReadyToShip({ orderId, subOrderId, sellerId }) {
  await Shipment.create({ orderId, subOrderId, sellerId }).catch((error) => {
    if (error?.code !== DUPLICATE_KEY) throw error;
  });
  const shipment = await Shipment.findOne({ subOrderId });
  if (shipment.status !== 'CREATING') return shipment; // already made ready, for real or as a mock
  shipment.pickupName = 'mock';
  shipment.awb = `MOCK${Date.now().toString(36).toUpperCase()}${String(subOrderId).slice(-4).toUpperCase()}`;
  shipment.courierName = 'Mock Courier';
  shipment.status = SHIPMENT_STATUS.READY_TO_SHIP;
  shipment.events.push({ status: SHIPMENT_STATUS.READY_TO_SHIP, providerStatus: 'MOCK', location: null, at: new Date() });
  return shipment.save();
}

/**
 * A courier update from Shiprocket's tracking webhook. Returns { shipment, status } when the parcel moved to a new status
 * (status is ours), or null when the update is unknown, old, or for a parcel that is not ours. Every update is kept in the
 * parcel's event history either way.
 */
export async function recordTracking({ awb, providerStatus, at = new Date(), location = null }) {
  const shipment = await Shipment.findOne({ awb });
  if (!shipment) return null;
  const next = mapShiprocketStatus(providerStatus);
  const moves = canAdvance(shipment.status, next);
  shipment.events.push({ status: moves ? next : null, providerStatus, location, at });
  if (moves) shipment.status = next;
  await shipment.save();
  return moves ? { shipment, status: next } : null;
}

export const getShipment = (shipmentId) => Shipment.findById(shipmentId);
export const getShipmentsBySubOrder = async (subOrderIds) => new Map((await Shipment.find({ subOrderId: { $in: subOrderIds } })).map((shipment) => [String(shipment.subOrderId), shipment]));
