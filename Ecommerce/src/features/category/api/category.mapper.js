import { categoryDetailResponseSchema, categoryTreeResponseSchema } from './category.schemas';

export const mapCategoryTree = payload =>
  categoryTreeResponseSchema.parse(payload).data.map(item => ({
    ...item,
    image: item.imageUrl,
  }));

export const mapCategoryDetail = payload => {
  const category = categoryDetailResponseSchema.parse(payload).data;
  return {
    ...category,
    heroBanner: category.heroBanner
      ? { ...category.heroBanner, image: category.heroBanner.imageUrl }
      : null,
    sections: category.sections.map(section => ({
      ...section,
      items: section.items.map(item => ({ ...item, image: item.imageUrl })),
    })),
  };
};
