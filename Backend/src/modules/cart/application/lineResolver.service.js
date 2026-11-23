import { getSettingsSection } from '../../admin/public/index.js';
import { dealPriceForVariant, getCampaignDealPrices } from '../../coupon/public/index.js';
import { getSellerSummaries } from '../../identity/public/index.js';
import { getPurchasableOffers } from '../../product/public/index.js';

export const LINE_ISSUE = Object.freeze({
  OFFER_UNAVAILABLE: 'OFFER_UNAVAILABLE', // gone, not live, or its product/category was taken down
  SELLER_UNAVAILABLE: 'SELLER_UNAVAILABLE', // the seller is suspended or on holiday
  OUT_OF_STOCK: 'OUT_OF_STOCK',
  QUANTITY_LIMIT: 'QUANTITY_LIMIT', // asked for more than can be bought at once
});

/**
 * What a customer would get for each requested { offerId, quantity }: whether it can be sold right now, from whom, at what
 * price and in what quantity. The cart, checkout and the order all price and check lines through this, so a line can
 * never look fine in one place and be refused in the next. Always reads current data. Lines come back in the order asked.
 *
 * Price: the shelf price, or a campaign deal price when one is running for that seller's product, there are enough deal
 * units left for the whole quantity, and it is lower. (Admin Deals are not shown to customers anywhere yet, so they do not
 * count; when a customer rail starts reading them, include them here, lowest price wins.)
 */
export async function resolveLines(requested, now = new Date()) {
  const offers = await getPurchasableOffers(requested.map((entry) => entry.offerId));
  const found = [...offers.values()];
  const [sellers, deals, { maxQtyPerOrder }] = await Promise.all([
    getSellerSummaries(found.map((offer) => offer.sellerId)),
    getCampaignDealPrices(found.map(({ sellerId, productId }) => ({ sellerId, productId })), now),
    getSettingsSection('orders'),
  ]);

  return requested.map(({ offerId, quantity }) => {
    const offer = offers.get(String(offerId));
    if (!offer) return { offerId: String(offerId), quantity, sellable: false, issueCode: LINE_ISSUE.OFFER_UNAVAILABLE };

    const seller = sellers.get(offer.sellerId);
    const maximumQuantity = Math.min(maxQtyPerOrder, offer.availableUnits);
    const deal = deals.get(`${offer.sellerId}:${offer.productId}`);
    const dealPricePaise = deal && dealPriceForVariant(deal, offer.mrpPaise);
    const onDeal = Boolean(deal) && dealPricePaise < offer.pricePaise && deal.remainingUnits >= quantity;
    const issueCode = !seller?.sellable ? LINE_ISSUE.SELLER_UNAVAILABLE
      : offer.availableUnits < 1 ? LINE_ISSUE.OUT_OF_STOCK
        : quantity > maximumQuantity ? LINE_ISSUE.QUANTITY_LIMIT
          : null;
    return {
      offerId: offer.offerId,
      productId: offer.productId,
      variantId: offer.variantId,
      sellerId: offer.sellerId,
      sellerName: seller?.name ?? 'Seller',
      categoryId: offer.categoryId,
      category: offer.category,
      assured: offer.assured,
      name: offer.name,
      brand: offer.brand,
      variantLabel: offer.variantLabel,
      weightG: offer.weightG,
      returnWindowDays: offer.returnWindowDays,
      imageUrl: offer.imageUrl,
      quantity,
      unitPricePaise: onDeal ? dealPricePaise : offer.pricePaise,
      mrpPaise: offer.mrpPaise,
      priceSource: onDeal ? 'CAMPAIGN' : 'SHELF',
      campaign: onDeal ? { submissionId: deal.submissionId, campaignId: deal.campaignId, name: deal.campaignName } : null,
      availableUnits: offer.availableUnits,
      minimumQuantity: 1,
      maximumQuantity,
      sellable: issueCode === null,
      issueCode,
    };
  });
}
