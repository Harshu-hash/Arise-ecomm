import { env } from '../../../config/env.js';
import { AppError } from '../../../shared/errors/AppError.js';

// Shiprocket adapter for the ShippingGateway port. Integer paise; grams in, rupees and kilograms converted here.
// The login token lasts 10 days: cached for 9, and refreshed once if Shiprocket answers 401.
const TOKEN_TTL_MS = 9 * 24 * 60 * 60 * 1000;
let token = null;
let tokenExpiresAt = 0;

const unavailable = (cause, message = 'Delivery rates are unavailable right now.') => new AppError({ code: 'SHIPPING_PROVIDER_ERROR', message, status: 502, retryable: true, cause });

function configured() {
  if (!env.SHIPROCKET_EMAIL || !env.SHIPROCKET_PASSWORD) throw new AppError({ code: 'SHIPPING_NOT_CONFIGURED', message: 'Shipping is not configured.', status: 503 });
}

async function send(path, { method = 'GET', body, bearer } = {}) {
  const response = await fetch(`${env.SHIPROCKET_API_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15_000),
  });
  return { status: response.status, payload: await response.json().catch(() => null) };
}

async function authorized(path, options = {}, refreshed = false) {
  configured();
  if (!token || Date.now() > tokenExpiresAt) {
    const { payload } = await send('/auth/login', { method: 'POST', body: { email: env.SHIPROCKET_EMAIL, password: env.SHIPROCKET_PASSWORD } });
    if (!payload?.token) throw new Error('Shiprocket login failed');
    token = payload.token;
    tokenExpiresAt = Date.now() + TOKEN_TTL_MS;
  }
  const result = await send(path, { ...options, bearer: token });
  if (result.status === 401 && !refreshed) {
    token = null;
    return authorized(path, options, true);
  }
  return result;
}

/** Shiprocket's own explanation, e.g. "Wallet balance is low", as plain text a seller can act on (it sometimes sends field errors as an object). */
function reason({ status, payload }) {
  const parts = (value) => (typeof value === 'string' ? [value] : Object.values(value ?? {}).flat().flatMap(parts));
  return [...parts(payload?.message), ...parts(payload?.errors)].join(' ') || `Shiprocket answered ${status}`;
}

async function call(work, message) {
  try {
    return await work();
  } catch (error) {
    throw error instanceof AppError ? error : unavailable(error, message);
  }
}

const rupees = (paise) => Math.round(paise) / 100;

export const shiprocketGateway = {
  /**
   * The cheapest courier between two pincodes for a prepaid parcel (or a cash-on-delivery one with `cod`): { serviceable, feePaise, etaDays }.
   * `serviceable: false` is a real answer (no courier covers the lane); any other failure throws a retryable 502.
   */
  quote: ({ pickupPincode, deliveryPincode, weightG, cod = false }) => call(async () => {
    const query = new URLSearchParams({ pickup_postcode: pickupPincode, delivery_postcode: deliveryPincode, weight: String(Math.max(weightG, 1) / 1000), cod: cod ? '1' : '0' });
    const { status, payload } = await authorized(`/courier/serviceability/?${query}`);
    const couriers = payload?.data?.available_courier_companies ?? [];
    if (status === 404 || payload?.status === 404 || (status === 200 && !couriers.length)) return { serviceable: false, feePaise: null, etaDays: null };
    if (status !== 200) throw new Error(`Shiprocket answered ${status}`);
    const cheapest = couriers.reduce((best, courier) => (Number(courier.rate) < Number(best.rate) ? courier : best));
    return { serviceable: true, feePaise: Math.round(Number(cheapest.rate) * 100), etaDays: Number(cheapest.estimated_delivery_days) || null };
  }),

  /** Registers a seller's address as a pickup location under `name`. Already existing under that name is fine. */
  ensurePickupLocation: ({ name, contactName, email, phone, address, city, state, pincode }) => call(async () => {
    const result = await authorized('/settings/company/addpickup', {
      method: 'POST',
      body: { pickup_location: name, name: contactName, email, phone, address, address_2: '', city, state, country: 'India', pin_code: pincode },
    });
    const exists = /already|exist/i.test(String(result.payload?.message ?? '') + JSON.stringify(result.payload?.errors ?? {}));
    if (result.status >= 400 && !exists) throw new AppError({ code: 'PICKUP_ADDRESS_REJECTED', status: 409, message: `The courier would not accept your pickup address: ${reason(result)} Update your store address in settings and try again.` });
  }, 'Could not register the pickup address.'),

  /** Whether a registered pickup location's phone is verified on Shiprocket: true or false, or null when it is not on the account. */
  isPickupVerified: (name) => call(async () => {
    const { status, payload } = await authorized('/settings/company/pickup');
    if (status !== 200) throw new Error(`Shiprocket answered ${status}`);
    const found = (payload?.data?.shipping_address ?? []).find((place) => place.pickup_location === name);
    return found ? found.phone_verified === 1 : null;
  }, 'Could not check the pickup address.'),

  /** Creates the order on Shiprocket: { shiprocketOrderId, shipmentId }. */
  createShipment: ({ reference, placedAt, pickupName, customer, items, weightG, dimsCm, collectPaise = null }) => call(async () => {
    const subTotal = items.reduce((sum, item) => sum + item.pricePaise * item.units, 0);
    // shortcut: for cash on delivery the courier collects sub_total + shipping_charges (the whole `collectPaise`, item prices already net of the coupon);
    // the charge fields follow Shiprocket's create-order API from memory and were NOT checked against a live account, so confirm the collected amount in a sandbox
    const cod = collectPaise == null ? {} : { shipping_charges: rupees(collectPaise - subTotal) };
    const result = await authorized('/orders/create/adhoc', {
      method: 'POST',
      body: {
        order_id: reference,
        order_date: placedAt.toISOString().slice(0, 16).replace('T', ' '),
        pickup_location: pickupName,
        billing_customer_name: customer.name,
        billing_last_name: '',
        billing_address: customer.address,
        billing_city: customer.city,
        billing_pincode: customer.pincode,
        billing_state: customer.state,
        billing_country: 'India',
        billing_email: customer.email,
        billing_phone: customer.phone,
        shipping_is_billing: true,
        order_items: items.map((item) => ({ name: item.name, sku: item.sku, units: item.units, selling_price: rupees(item.pricePaise) })),
        payment_method: collectPaise == null ? 'Prepaid' : 'COD',
        sub_total: rupees(subTotal),
        ...cod,
        length: dimsCm.l, breadth: dimsCm.w, height: dimsCm.h,
        weight: Math.max(weightG, 1) / 1000,
      },
    });
    const { order_id: shiprocketOrderId, shipment_id: shipmentId } = result.payload ?? {};
    if (result.status >= 400 || !shipmentId) throw unavailable(new Error(reason(result)), `Shiprocket would not create the shipment: ${reason(result)}`);
    return { shiprocketOrderId: String(shiprocketOrderId), shipmentId: String(shipmentId) };
  }, 'Could not create the shipment.'),

  /** Shiprocket picks a courier and gives the parcel its tracking number: { awb, courierName }. */
  assignAwb: (shipmentId, { isReturn = false } = {}) => call(async () => {
    const result = await authorized('/courier/assign/awb', { method: 'POST', body: { shipment_id: shipmentId, ...(isReturn ? { is_return: 1 } : {}) } });
    const data = result.payload?.response?.data ?? result.payload?.data;
    if (result.status >= 400 || !data?.awb_code) throw unavailable(new Error(reason(result)), `Shiprocket could not assign a courier: ${data?.awb_assign_error ?? reason(result)}`);
    return { awb: String(data.awb_code), courierName: data.courier_name ?? null };
  }, 'Could not assign a courier.'),

  /**
   * A reverse shipment: the courier collects from `pickup` (the customer) and delivers to `drop` (the seller): { shiprocketOrderId, shipmentId }.
   * shortcut: field names follow Shiprocket's "create return order" API from memory and were NOT checked against a live account; confirm in a sandbox before going live.
   */
  createReturnShipment: ({ reference, placedAt, pickup, drop, items, weightG, dimsCm }) => call(async () => {
    const subTotal = items.reduce((sum, item) => sum + item.pricePaise * item.units, 0);
    const result = await authorized('/orders/create/return', {
      method: 'POST',
      body: {
        order_id: reference,
        order_date: placedAt.toISOString().slice(0, 10),
        pickup_customer_name: pickup.name, pickup_address: pickup.address, pickup_city: pickup.city, pickup_state: pickup.state,
        pickup_country: 'India', pickup_pincode: pickup.pincode, pickup_email: pickup.email, pickup_phone: pickup.phone,
        shipping_customer_name: drop.name, shipping_address: drop.address, shipping_city: drop.city, shipping_state: drop.state,
        shipping_country: 'India', shipping_pincode: drop.pincode, shipping_email: drop.email, shipping_phone: drop.phone,
        order_items: items.map((item) => ({ name: item.name, sku: item.sku, units: item.units, selling_price: rupees(item.pricePaise) })),
        payment_method: 'PREPAID',
        total_discount: '0',
        sub_total: rupees(subTotal),
        length: dimsCm.l, breadth: dimsCm.w, height: dimsCm.h,
        weight: Math.max(weightG, 1) / 1000,
      },
    });
    const { order_id: shiprocketOrderId, shipment_id: shipmentId } = result.payload ?? {};
    if (result.status >= 400 || !shipmentId) throw unavailable(new Error(reason(result)), `Shiprocket would not create the return pickup: ${reason(result)}`);
    return { shiprocketOrderId: String(shiprocketOrderId), shipmentId: String(shipmentId) };
  }, 'Could not create the return pickup.'),

  /**
   * Cancels a shipment that has not been collected yet, by its tracking number.
   * shortcut: the endpoint and body are from memory and NOT verified against a live account; confirm in a sandbox before going live.
   */
  cancelShipment: (awb) => call(async () => {
    const result = await authorized('/orders/cancel/shipment/awbs', { method: 'POST', body: { awbs: [awb] } });
    if (result.status >= 400) throw unavailable(new Error(reason(result)), `Shiprocket would not cancel the pickup: ${reason(result)}`);
  }, 'Could not cancel the pickup.'),

  generateLabel: (shipmentId) => call(async () => {
    const result = await authorized('/courier/generate/label', { method: 'POST', body: { shipment_id: [Number(shipmentId)] } });
    if (result.status >= 400 || !result.payload?.label_url) throw unavailable(new Error(reason(result)), `Shiprocket could not make the label: ${reason(result)}`);
    return { labelUrl: result.payload.label_url };
  }, 'Could not make the label.'),

  /** Asks the courier to collect the parcel from the seller. */
  requestPickup: (shipmentId) => call(async () => {
    const result = await authorized('/courier/generate/pickup', { method: 'POST', body: { shipment_id: [Number(shipmentId)] } });
    if (result.status >= 400) throw unavailable(new Error(reason(result)), `Shiprocket could not schedule the pickup: ${reason(result)}`);
  }, 'Could not schedule the pickup.'),
};
