// Cart money, in integer paise. Pure, so the cart screen, checkout and the order all get the same numbers.

/** What a coupon really takes off: a delivery coupon only covers the delivery fee; any other kind is capped at the items' total. */
export function couponSaving(coupon, { subtotalPaise, deliveryFeePaise }) {
  if (!coupon) return 0;
  const room = coupon.type === 'FREE_DELIVERY' ? deliveryFeePaise : subtotalPaise;
  return Math.max(0, Math.min(coupon.discountPaise, room));
}

/**
 * Totals for the lines that can be bought ({ unitPricePaise, mrpPaise, quantity } each). Delivery is a flat fee that
 * goes away from the free-delivery threshold (checkout replaces it with a real shipping quote); the platform fee applies to
 * any non-empty order. `coupon` is { type, discountPaise } or null. An empty cart owes nothing.
 */
export function computeTotals(lines, { coupon = null, fees }) {
  if (!lines.length) {
    return { mrpPaise: 0, subtotalPaise: 0, productDiscountPaise: 0, couponDiscountPaise: 0, deliveryFeePaise: 0, platformFeePaise: 0, payablePaise: 0 };
  }
  const subtotalPaise = lines.reduce((sum, line) => sum + line.unitPricePaise * line.quantity, 0);
  const mrpPaise = lines.reduce((sum, line) => sum + Math.max(line.mrpPaise, line.unitPricePaise) * line.quantity, 0);
  const deliveryFeePaise = subtotalPaise >= fees.deliveryFeeFreeThresholdPaise ? 0 : fees.deliveryFeePaise;
  const couponDiscountPaise = couponSaving(coupon, { subtotalPaise, deliveryFeePaise });
  return {
    mrpPaise,
    subtotalPaise,
    productDiscountPaise: mrpPaise - subtotalPaise,
    couponDiscountPaise,
    deliveryFeePaise,
    platformFeePaise: fees.platformFeePaise,
    payablePaise: subtotalPaise - couponDiscountPaise + deliveryFeePaise + fees.platformFeePaise,
  };
}
