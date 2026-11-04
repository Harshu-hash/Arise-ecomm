import {
  createCategoryDetailFixtureEnvelope,
  createCategoryTreeFixtureEnvelope,
} from '@mocks/customerCatalogAdapter';
import { mapCategoryDetail, mapCategoryTree } from './category.mapper';

describe('category contract mappers', () => {
  it('maps the category tree image contract for the existing UI', () => {
    const categories = mapCategoryTree(createCategoryTreeFixtureEnvelope());

    expect(categories[0]).toMatchObject({ id: 'foryou', name: 'For You' });
    expect(categories.find(category => category.id === 'fashion')?.image).toMatch(/^https:/);
  });

  it('maps category detail sections and hero content', () => {
    const category = mapCategoryDetail(createCategoryDetailFixtureEnvelope('fashion'));

    expect(category).toMatchObject({ id: 'fashion', name: 'Fashion' });
    expect(category.heroBanner.image).toMatch(/^https:/);
    expect(category.sections[0].items[0].image).toMatch(/^https:/);
  });

  it('rejects malformed category tiles', () => {
    const payload = createCategoryDetailFixtureEnvelope('fashion');
    payload.data.sections[0].items[0].imageUrl = 'not-a-url';

    expect(() => mapCategoryDetail(payload)).toThrow();
  });
});
