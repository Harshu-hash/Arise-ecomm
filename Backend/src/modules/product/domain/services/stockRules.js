/** Units a shopper can still buy from an offer: what the seller has, less what other checkouts are holding. */
export const availableUnits = (offer) => Math.max(0, offer.stock - (offer.reserved ?? 0));
