import { mapProductCard } from '@features/product/api/product.mapper';
import { searchProductsResponseSchema, searchSuggestionsResponseSchema } from './search.schemas';

export const mapSearchSuggestions = payload => {
  const data = searchSuggestionsResponseSchema.parse(payload).data;
  return {
    ...data,
    suggestions: data.suggestions.map(item => ({ ...item, image: item.imageUrl })),
  };
};

export const mapSearchProducts = payload => {
  const data = searchProductsResponseSchema.parse(payload).data;
  return { ...data, items: data.items.map(mapProductCard) };
};
