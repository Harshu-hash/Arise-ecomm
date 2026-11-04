import { createBrandsFixtureEnvelope } from '@mocks/customerCatalogAdapter';
import { mapBrandsResponse } from './brands.mapper';

describe('brands contract mapper', () => {
  it('maps filtered brand responses', () => {
    const brands = mapBrandsResponse(createBrandsFixtureEnvelope('Electronics'));

    expect(brands.filters).toContain('Electronics');
    expect(brands.items.length).toBeGreaterThan(0);
    expect(brands.items.every(brand => brand.category === 'Electronics')).toBe(true);
    expect(brands.items[0].image).toMatch(/^https:/);
  });
});
