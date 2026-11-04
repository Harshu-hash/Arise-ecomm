import { flashSaleResponseSchema } from './flashSale.schemas';

export const mapFlashSale = payload => {
  const sale = flashSaleResponseSchema.parse(payload).data;
  return {
    ...sale,
    items: sale.items.map(item => ({
      ...item,
      title: item.name,
      image: item.imageUrl,
      price: item.pricePaise / 100,
      mrp: item.mrpPaise / 100,
    })),
  };
};
