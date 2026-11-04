import { recentlyViewedResponseSchema } from './recentlyViewed.schemas';

export const mapRecentlyViewed = payload => {
  const value = recentlyViewedResponseSchema.parse(payload).data;
  return { ...value, items: value.items.map(item => ({ ...item, image: item.imageUrl })) };
};
