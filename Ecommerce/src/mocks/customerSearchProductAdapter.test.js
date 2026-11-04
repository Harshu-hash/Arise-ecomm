import { customerSearchProductFixtureAdapter } from './customerSearchProductAdapter';

describe('customerSearchProductFixtureAdapter', () => {
  it('paginates search results using opaque cursor values', async () => {
    const first = await customerSearchProductFixtureAdapter({
      url: '/search',
      method: 'get',
      params: { limit: 2 },
    });
    const second = await customerSearchProductFixtureAdapter({
      url: '/search',
      method: 'get',
      params: { limit: 2, cursor: first.data.data.nextCursor },
    });

    expect(first.data.data.items).toHaveLength(2);
    expect(second.data.data.items).toHaveLength(2);
    expect(second.data.data.items[0].id).not.toBe(first.data.data.items[0].id);
  });

  it('serves product detail for search and recommendation cards', async () => {
    const response = await customerSearchProductFixtureAdapter({
      url: '/products/sim1',
      method: 'get',
    });

    expect(response.data.data).toMatchObject({ id: 'sim1', available: true });
  });

  it('returns a recoverable error for an invalid product deep link', async () => {
    await expect(
      customerSearchProductFixtureAdapter({ url: '/products/missing', method: 'get' }),
    ).rejects.toMatchObject({
      response: { status: 404, data: { error: { code: 'PRODUCT_NOT_FOUND' } } },
    });
  });
});
