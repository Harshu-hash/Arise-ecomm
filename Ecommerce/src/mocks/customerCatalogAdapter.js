import { AxiosError } from 'axios';
import {
  MAIN_SIDEBAR_CATEGORIES,
  getCategoryContent,
} from '@features/category/data/categoriesData';
import { ALL_BRANDS, BRAND_FILTERS } from '@features/brands/data/brandsData';

const LATENCY_MS = 300;
const wait = () => new Promise(resolve => setTimeout(resolve, LATENCY_MS));
const response = (config, data, status = 200) => ({
  data,
  status,
  statusText: status < 400 ? 'OK' : 'Error',
  headers: { 'content-type': 'application/json' },
  config,
  request: null,
});
const reject = (config, status, code, message) => {
  throw new AxiosError(
    message,
    code,
    config,
    null,
    response(config, { error: { code, message } }, status),
  );
};

const categoryTreeEnvelope = () => ({
  data: MAIN_SIDEBAR_CATEGORIES.map(category => ({
    id: category.id,
    name: category.name,
    imageUrl: category.image ?? null,
    icon: category.icon ?? null,
  })),
});

const categoryDetailEnvelope = categoryId => {
  const summary = MAIN_SIDEBAR_CATEGORIES.find(category => category.id === categoryId);
  if (!summary) return null;
  const content = getCategoryContent(categoryId);
  return {
    data: {
      id: summary.id,
      name: summary.name,
      heroBanner: content.heroBanner
        ? { title: content.heroBanner.title, imageUrl: content.heroBanner.image }
        : null,
      sections: content.sections.map((section, index) => ({
        id: `${categoryId}-section-${index + 1}`,
        title: section.title,
        viewAll: Boolean(section.viewAll),
        items: section.items.map(item => ({
          id: item.id,
          label: item.label,
          imageUrl: item.image,
          badge: item.badge ?? null,
          badgeVariant: item.badgeVariant ?? null,
          target: { type: 'SEARCH', id: item.label },
        })),
      })),
    },
  };
};

const brandsEnvelope = filter => {
  const items = ALL_BRANDS.map((brand, index) => ({
    id: brand.id,
    name: brand.name,
    imageUrl: brand.image,
    offerText: brand.discount,
    category: brand.category,
    popular: index < 5,
  })).filter(brand => {
    if (!filter || filter === 'All') return true;
    if (filter === 'Popular') return brand.popular;
    return brand.category === filter;
  });
  return { data: { filters: BRAND_FILTERS, items, nextCursor: null } };
};

export const customerCatalogFixtureAdapter = async config => {
  await wait();
  if (config.url === '/categories/tree' && config.method === 'get') {
    return response(config, categoryTreeEnvelope());
  }
  if (config.url?.startsWith('/categories/') && config.method === 'get') {
    const categoryId = decodeURIComponent(config.url.slice('/categories/'.length));
    const envelope = categoryDetailEnvelope(categoryId);
    if (!envelope) {
      return reject(config, 404, 'CATEGORY_NOT_FOUND', 'This category is no longer available.');
    }
    return response(config, envelope);
  }
  if (config.url === '/brands' && config.method === 'get') {
    return response(config, brandsEnvelope(config.params?.filter));
  }
  return reject(
    config,
    501,
    'FIXTURE_NOT_IMPLEMENTED',
    `No fixture exists for ${config.method?.toUpperCase()} ${config.url}.`,
  );
};

export { brandsEnvelope as createBrandsFixtureEnvelope };
export { categoryDetailEnvelope as createCategoryDetailFixtureEnvelope };
export { categoryTreeEnvelope as createCategoryTreeFixtureEnvelope };
