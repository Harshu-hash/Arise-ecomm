export const CATEGORY_ENDPOINTS = Object.freeze({
  tree: '/categories/tree',
  detail: categoryId => `/categories/${encodeURIComponent(categoryId)}`,
});
