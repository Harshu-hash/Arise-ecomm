import { customerCatalogFixtureAdapter } from './customerCatalogAdapter';

describe('customerCatalogFixtureAdapter', () => {
  it('serves category tree and detail contracts', async () => {
    const tree = await customerCatalogFixtureAdapter({
      url: '/categories/tree',
      method: 'get',
    });
    const detail = await customerCatalogFixtureAdapter({
      url: '/categories/fashion',
      method: 'get',
    });

    expect(tree.data.data).toEqual(expect.any(Array));
    expect(detail.data.data).toMatchObject({ id: 'fashion', sections: expect.any(Array) });
  });

  it('returns a recoverable not-found response for invalid deep links', async () => {
    await expect(
      customerCatalogFixtureAdapter({ url: '/categories/missing', method: 'get' }),
    ).rejects.toMatchObject({
      response: {
        status: 404,
        data: { error: { code: 'CATEGORY_NOT_FOUND' } },
      },
    });
  });

  it('filters brands through the same query contract as production', async () => {
    const response = await customerCatalogFixtureAdapter({
      url: '/brands',
      method: 'get',
      params: { filter: 'Fashion' },
    });

    expect(response.data.data.items.length).toBeGreaterThan(0);
    expect(response.data.data.items.every(brand => brand.category === 'Fashion')).toBe(true);
  });
});
