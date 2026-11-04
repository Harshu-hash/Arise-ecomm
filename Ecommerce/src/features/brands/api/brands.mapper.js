import { brandsResponseSchema } from './brands.schemas';

export const mapBrandsResponse = payload => {
  const data = brandsResponseSchema.parse(payload).data;
  return {
    ...data,
    items: data.items.map(item => ({
      ...item,
      image: item.imageUrl,
      discount: item.offerText,
    })),
  };
};
