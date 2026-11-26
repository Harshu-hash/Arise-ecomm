import { mapAddress } from '@features/address/api/address.mapper';
import { checkoutSessionResponseSchema } from './checkout.schemas';

const toRupees = paise => paise / 100;
const mapTotals = totals =>
  Object.fromEntries(
    Object.entries(totals).map(([key, value]) => [key.replace('Paise', ''), toRupees(value)]),
  );

// What the order will really cost to this address (the server's delivery quote and fees), before a checkout is created.
export const mapCheckoutPreview = payload => {
  const { totals, blockers, warnings } = payload.data;
  return { totals: mapTotals(totals), blockers, warnings };
};

export const mapCheckoutSession = payload => {
  const session = checkoutSessionResponseSchema.parse(payload).data;
  return {
    ...session,
    address: mapAddress(session.address),
    items: session.lines.map(line => ({
      id: line.lineId,
      productId: line.productId,
      name: line.name,
      image: line.imageUrl,
      variant: line.variantLabel,
      qty: line.quantity,
      price: toRupees(line.unitPricePaise),
      mrp: toRupees(line.mrpPaise),
      lineTotal: toRupees(line.lineTotalPaise),
      sellerId: line.sellerId,
      sellerName: line.sellerName,
      deliveryPromise: line.deliveryPromise,
    })),
    totals: mapTotals(session.totals),
    walletBalance: toRupees(session.walletBalancePaise),
  };
};
