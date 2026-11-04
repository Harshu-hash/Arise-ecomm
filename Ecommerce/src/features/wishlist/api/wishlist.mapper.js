import { mapProductCard } from '@features/product/api/product.mapper';
import {
  wishlistMoveResponseSchema,
  wishlistMutationResponseSchema,
  wishlistResponseSchema,
} from './wishlist.schemas';

export const mapWishlist = payload => {
  const data = wishlistResponseSchema.parse(payload).data;
  return {
    ...data,
    items: data.items.map(item => ({
      ...mapProductCard(item),
      addedAt: item.addedAt,
      inStock: item.available,
    })),
  };
};

export const mapWishlistMutation = payload => wishlistMutationResponseSchema.parse(payload).data;
export const mapWishlistMove = payload => wishlistMoveResponseSchema.parse(payload).data;
