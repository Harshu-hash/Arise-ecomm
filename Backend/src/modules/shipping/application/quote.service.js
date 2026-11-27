import { shippingGateway } from '../../../infrastructure/external/shipping/index.js';
import { logger } from '../../../config/logger.js';
import { AppError } from '../../../shared/errors/AppError.js';
import { getSettingsSection } from '../../admin/public/index.js';

/**
 * What delivering one parcel costs: { serviceable, feePaise, etaDays, source }. Shiprocket's cheapest courier is the price.
 * When Shiprocket cannot be reached the flat fee from the platform's Fees settings is charged instead (source FALLBACK),
 * but "no courier serves this pincode" is never papered over: it comes back serviceable: false. `cod` asks for a cash-on-delivery parcel.
 */
export async function quoteShipping({ pickupPincode, deliveryPincode, weightG, cod = false }) {
  if (!pickupPincode) return fallback(); // a seller without an address on file cannot be quoted; do not block the order for it
  try {
    return { ...(await shippingGateway.quote({ pickupPincode, deliveryPincode, weightG, cod })), source: 'SHIPROCKET' };
  } catch (error) {
    logger.warn({ err: error, pickupPincode, deliveryPincode }, 'Shiprocket quote failed; charging the flat delivery fee');
    return fallback();
  }
}

async function fallback() {
  const { deliveryFeePaise, flatDeliveryEnabled } = await getSettingsSection('fees');
  if (flatDeliveryEnabled === false) throw new AppError({ code: 'SHIPPING_PROVIDER_ERROR', message: 'Delivery rates are unavailable right now.', status: 502, retryable: true });
  return { serviceable: true, feePaise: deliveryFeePaise, etaDays: null, source: 'FALLBACK' };
}
