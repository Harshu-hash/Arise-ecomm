export { getCustomerCouponHistory, recordOrderPlaced, reverseOrderPlaced } from '../application/couponRedemption.service.js';
export { evaluateCouponsForCart } from '../application/customerCoupon.service.js';
export { dealPriceForVariant, getCampaignDealPrices,listHomeCampaignSections } from '../application/customerCampaign.service.js';
export { listHomePlacedCampaigns } from '../application/campaign.service.js';

// Read access for the analytics module (it aggregates; it never writes this).
export { OrderCouponRecord } from '../infrastructure/persistence/orderCouponRecord.model.js';
