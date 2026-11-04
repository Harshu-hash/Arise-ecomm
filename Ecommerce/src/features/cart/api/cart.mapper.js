import { mapProductCard } from '@features/product/api/product.mapper';
import { cartResponseSchema, eligibleCouponsResponseSchema } from './cart.schemas';

const toRupees = paise => paise / 100;
const mapCoupon = coupon =>
  coupon
    ? {
        code: coupon.code,
        desc: coupon.description,
        amount: toRupees(coupon.discountPaise),
        minOrder: toRupees(coupon.minimumSubtotalPaise),
      }
    : null;
const mapCartItem = item => ({
  ...mapProductCard(item),
  id: item.cartItemId,
  cartItemId: item.cartItemId,
  productId: item.productId,
  variantId: item.variantId,
  variant: item.variantLabel,
  offerId: item.offerId,
  sellerId: item.sellerId,
  sellerName: item.sellerName,
  qty: item.quantity,
  minQty: item.minimumQuantity,
  maxQty: item.maximumQuantity,
  available: item.available,
  issueCode: item.issueCode,
});

export const mapCart = payload => {
  const cart = cartResponseSchema.parse(payload).data;
  return {
    ...cart,
    items: cart.items.map(mapCartItem),
    savedForLater: cart.savedItems.map(mapCartItem),
    appliedCoupon: mapCoupon(cart.appliedCoupon),
    totals: Object.fromEntries(
      Object.entries(cart.totals).map(([key, value]) => [
        key.replace('Paise', ''),
        toRupees(value),
      ]),
    ),
  };
};

export const mapEligibleCoupons = payload =>
  eligibleCouponsResponseSchema.parse(payload).data.items.map(mapCoupon);
