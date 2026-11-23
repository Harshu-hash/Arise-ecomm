// Order money in integer paise. Pure, so the checkout quote and the placed order can never disagree.
// Prices are GST-inclusive: the GST on a line is the part of what the customer paid for it, not an extra.

/** Splits `total` across `weights` in proportion, whole paise only; the parts always add up to `total`. */
export function allocate(total, weights) {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (!sum || total <= 0) return weights.map(() => 0);
  const shares = weights.map((weight) => (total * weight) / sum);
  const parts = shares.map(Math.floor);
  let left = total - parts.reduce((a, b) => a + b, 0);
  const byRemainder = shares.map((share, index) => [share - parts[index], index]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (const [, index] of byRemainder) {
    if (left <= 0) break;
    parts[index] += 1;
    left -= 1;
  }
  return parts;
}

export const inclusiveGst =(paise, ratePct) => Math.round((paise * ratePct) / (100 + ratePct));

/**
 * @param lines     [{ offerId, sellerId, categoryId, unitPricePaise, mrpPaise, quantity, ... }] (extra fields are kept)
 * @param shipping  Map(sellerId -> delivery fee paise): one parcel per seller
 * @param coupon    { type, discountPaise } or null. A FREE_DELIVERY coupon comes off delivery, any other off the items.
 * @param terms     Map(categoryId -> { gstRate, hsnCode, commissionPct })
 * Returns { lines, sellers: [{ sellerId, lines, itemsPaise, discountPaise, shippingPaise, shippingDiscountPaise, payablePaise }], totals }.
 */
export function priceOrder({ lines, shipping, coupon = null, platformFeePaise = 0, codFeePaise = 0, terms }) {
  const amounts = lines.map((line) => line.unitPricePaise * line.quantity);
  const subtotalPaise = amounts.reduce((a, b) => a + b, 0);
  const sellerIds = [...new Set(lines.map((line) => line.sellerId))];
  const deliveryFeePaise = sellerIds.reduce((sum, id) => sum + (shipping.get(id) ?? 0), 0);

  const onDelivery = coupon?.type === 'FREE_DELIVERY';
  const itemDiscountPaise = !coupon || onDelivery ? 0 : Math.min(coupon.discountPaise, subtotalPaise);
  const deliveryDiscountPaise = onDelivery ? Math.min(coupon.discountPaise, deliveryFeePaise) : 0;
  const lineDiscounts = allocate(itemDiscountPaise, amounts);
  const shippingDiscounts = allocate(deliveryDiscountPaise, sellerIds.map((id) => shipping.get(id) ?? 0));

  const priced = lines.map((line, index) => {
    const paidPaise = amounts[index] - lineDiscounts[index];
    const term = terms.get(String(line.categoryId)) ?? { gstRate: 0, hsnCode: null, commissionPct: 0 };
    return {
      ...line,
      amountPaise: amounts[index],
      discountPaise: lineDiscounts[index],
      paidPaise,
      hsnCode: term.hsnCode,
      gstRate: term.gstRate,
      gstPaise: inclusiveGst(paidPaise, term.gstRate),
      commissionPct: term.commissionPct,
      commissionPaise: Math.round((paidPaise * term.commissionPct) / 100),
    };
  });

  const sellers = sellerIds.map((sellerId, index) => {
    const mine = priced.filter((line) => line.sellerId === sellerId);
    const itemsPaise = mine.reduce((sum, line) => sum + line.amountPaise, 0);
    const discountPaise = mine.reduce((sum, line) => sum + line.discountPaise, 0);
    const shippingPaise = shipping.get(sellerId) ?? 0;
    const shippingDiscountPaise = shippingDiscounts[index];
    return { sellerId, lines: mine, itemsPaise, discountPaise, shippingPaise, shippingDiscountPaise, payablePaise: itemsPaise - discountPaise + shippingPaise - shippingDiscountPaise };
  });

  const mrpPaise = lines.reduce((sum, line) => sum + Math.max(line.mrpPaise, line.unitPricePaise) * line.quantity, 0);
  const couponDiscountPaise = itemDiscountPaise + deliveryDiscountPaise;
  return {
    lines: priced,
    sellers,
    totals: {
      mrpPaise,
      subtotalPaise,
      productDiscountPaise: mrpPaise - subtotalPaise,
      couponDiscountPaise,
      deliveryFeePaise,
      platformFeePaise,
      codFeePaise,
      taxPaise: priced.reduce((sum, line) => sum + line.gstPaise, 0),
      walletCreditPaise: 0,
      payablePaise: subtotalPaise - couponDiscountPaise + deliveryFeePaise + platformFeePaise + codFeePaise,
    },
  };
}

/** What a parcel's items cost the customer after their coupon share; delivery and platform fees are not part of it. */
export const itemsPaidPaise = (sub) => sub.items.reduce((sum, item) => sum + item.amountPaise - item.discountPaise, 0);
