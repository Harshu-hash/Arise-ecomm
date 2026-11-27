import { CATEGORY, notify } from '../../notification/public/index.js';
import { getLiveProductCards } from '../../product/public/index.js';
import { WishlistItem } from '../infrastructure/persistence/wishlistItem.model.js';

const BATCH = 1000;
const rupees = (paise) => `₹${(paise / 100).toLocaleString('en-IN')}`;

/**
 * Tells customers when a product they saved gets cheaper or comes back in stock. Each saved row remembers the price and
 * availability last seen (the first run only records them), and each message is keyed by what changed, so nothing repeats.
 * shortcut: an hourly scan capped at BATCH rows; move to change events from the catalog if wishlists outgrow it.
 * Returns how many were sent.
 */
export async function sendWishlistAlerts() {
  const rows = await WishlistItem.find({}).sort({ _id: 1 }).limit(BATCH).lean();
  const cards = await getLiveProductCards([...new Set(rows.map((row) => row.productId))]);
  let sent = 0;
  const updates = [];
  for (const row of rows) {
    const card = cards.get(row.productId);
    const available = Boolean(card?.inStock);
    const price = card?.pricePaise ?? row.seenPricePaise ?? null;
    if (row.seenAvailable == null) {
      updates.push({ updateOne: { filter: { _id: row._id }, update: { $set: { seenPricePaise: price, seenAvailable: available } } } });
      continue;
    }
    const target = { type: 'PRODUCT', entityId: row.productId };
    if (available && !row.seenAvailable && await notify({ to: { type: 'CUSTOMER', id: row.customerId }, category: CATEGORY.OFFER, key: `back-in-stock:${row.productId}:${row.customerId}:${row._id}:${price}`, title: 'Back in stock', body: `${card.name} from your wishlist is available again.`, target })) sent += 1;
    if (available && row.seenPricePaise != null && price < row.seenPricePaise && await notify({ to: { type: 'CUSTOMER', id: row.customerId }, category: CATEGORY.OFFER, key: `price-drop:${row.productId}:${row.customerId}:${price}`, title: 'Price drop on your wishlist', body: `${card.name} fell from ${rupees(row.seenPricePaise)} to ${rupees(price)}.`, target })) sent += 1;
    if (price !== row.seenPricePaise || available !== row.seenAvailable) updates.push({ updateOne: { filter: { _id: row._id }, update: { $set: { seenPricePaise: price, seenAvailable: available } } } });
  }
  if (updates.length) await WishlistItem.bulkWrite(updates);
  return sent;
}
