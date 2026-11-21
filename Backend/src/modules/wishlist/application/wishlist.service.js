import { AppError } from '../../../shared/errors/AppError.js';
import { getLiveProductCards } from '../../product/public/index.js';
import { WishlistItem } from '../infrastructure/persistence/wishlistItem.model.js';

const toItem = (card, addedAt) => ({
  id: card.id,
  name: card.name,
  brand: card.brand,
  category: card.category,
  imageUrl: card.imageUrl,
  pricePaise: card.pricePaise,
  mrpPaise: card.mrpPaise,
  rating: card.rating,
  ratingCount: card.ratingCount,
  assured: card.assured,
  addedAt,
  available: card.inStock,
});

/** Newest first. A saved product that is off the shelf right now is left out (and shows again once it is back). */
export async function listWishlist(customerId) {
  const saved = await WishlistItem.find({ customerId }).sort({ addedAt: -1, _id: -1 }).lean();
  const cards = await getLiveProductCards(saved.map((item) => item.productId));
  const items = saved.flatMap((item) => (cards.has(item.productId) ? [toItem(cards.get(item.productId), item.addedAt)] : []));
  return { items, total: items.length };
}

/** Saving twice is fine: the product keeps its first save date and place. */
export async function addToWishlist(customerId, productId) {
  if (!(await getLiveProductCards([productId])).has(productId)) {
    throw new AppError({ code: 'PRODUCT_NOT_FOUND', message: 'This product is unavailable.', status: 404 });
  }
  try {
    await WishlistItem.updateOne({ customerId, productId }, { $setOnInsert: { addedAt: new Date() } }, { upsert: true });
  } catch (error) {
    if (error?.code !== 11000) throw error; // a parallel save of the same product won the race
  }
  return { productId, wishlisted: true };
}

/** Removing something that is not saved (or no longer sold) succeeds too. */
export async function removeFromWishlist(customerId, productId) {
  await WishlistItem.deleteOne({ customerId, productId });
  return { productId, wishlisted: false };
}

export const deleteCustomerWishlist = (customerId) => WishlistItem.deleteMany({ customerId: String(customerId) });
