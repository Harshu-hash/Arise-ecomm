import {
  promotionProductsResponseSchema,
  promotionResponseSchema,
  promotionsResponseSchema,
} from './offers.schemas';

const mapItem = item => ({ ...item, image: item.imageUrl });
const mapProduct = item => ({
  ...item,
  image: item.imageUrl,
  price: item.pricePaise / 100,
  mrp: item.mrpPaise / 100,
});
const mapPromotionModel = promotion => ({
  ...promotion,
  items: promotion.items.map(mapItem),
});

export const mapPromotions = payload => {
  const value = promotionsResponseSchema.parse(payload).data;
  return { ...value, items: value.items.map(mapPromotionModel) };
};
export const mapPromotion = payload => {
  const value = promotionResponseSchema.parse(payload).data;
  return { ...mapPromotionModel(value), relatedProducts: value.relatedProducts.map(mapProduct) };
};
export const mapPromotionProducts = payload => {
  const value = promotionProductsResponseSchema.parse(payload).data;
  return { ...value, items: value.items.map(mapProduct) };
};
