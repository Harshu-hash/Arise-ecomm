import { productDetailResponseSchema } from './product.schemas';

const toRupees = paise => paise / 100;

export const mapProductCard = product => ({
  id: product.id,
  name: product.name,
  brand: product.brand,
  category: product.category,
  image: product.imageUrl,
  price: toRupees(product.pricePaise),
  mrp: toRupees(product.mrpPaise),
  rating: product.rating,
  ratingCount: product.ratingCount,
  assured: product.assured,
  deliveryDate: product.deliveryLabel,
});

export const mapProductDetail = payload => {
  const product = productDetailResponseSchema.parse(payload).data;
  return {
    ...mapProductCard(product),
    images: product.images,
    reviewCount: product.reviewCount,
    color: product.color,
    sizes: product.sizes,
    address: product.deliveryAddressLabel,
    description: product.description,
    fit: product.fit,
    modelInfo: product.modelInfo,
    care: product.care,
    productCode: product.productCode,
    manufacturer: product.manufacturer,
    countryOfOrigin: product.countryOfOrigin,
    available: product.available,
  };
};
