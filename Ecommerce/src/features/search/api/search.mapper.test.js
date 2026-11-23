import {
  createSearchFixtureEnvelope,
  createSuggestionsFixtureEnvelope,
} from '@mocks/customerSearchProductAdapter';
import { mapSearchProducts, mapSearchSuggestions } from './search.mapper';

describe('search contract mappers', () => {
  it('maps suggestions into image-ready UI records', () => {
    const result = mapSearchSuggestions(createSuggestionsFixtureEnvelope('shirt'));

    expect(result.suggestions.length).toBeGreaterThan(0);
    expect(result.suggestions[0]).toEqual(
      expect.objectContaining({ id: expect.any(String), image: expect.stringMatching(/^https:/) }),
    );
  });

  it('maps paginated product results and facets', () => {
    const result = mapSearchProducts(createSearchFixtureEnvelope({ limit: 2 }));

    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        price: expect.any(Number),
        image: expect.stringMatching(/^https:/),
      }),
    );
    expect(result.nextCursor).toBe('2');
    expect(result.facets.priceRanges.length).toBeGreaterThan(0);
  });

  it('rejects malformed search result records', () => {
    const payload = createSearchFixtureEnvelope({ limit: 1 });
    payload.data.items[0].imageUrl = 'not-a-url';

    expect(() => mapSearchProducts(payload)).toThrow();
  });
});

describe('search against the real backend shapes', () => {
  it('accepts suggestions as the server sends them (brand and category rows have no thumbnail of their own)', () => {
    const result = mapSearchSuggestions({
      data: {
        suggestions: [
          { id: 'p:1', text: 'Nike Revolution Running Shoes', category: 'Running Shoes', type: 'arrow', imageUrl: 'http://10.0.0.2:4000/uploads/products/1.png' },
          { id: 'b:2', text: 'Nike', category: 'Brand', type: 'chevron', imageUrl: 'http://10.0.0.2:4000/uploads/brands/nike.png' },
          { id: 'c:Shoes', text: 'Shoes', category: null, type: 'chevron', imageUrl: 'http://10.0.0.2:4000/uploads/products/1.png' },
        ],
        trending: ['nike shoes', 'Puma'],
        prompts: ['Puma nike shoes'],
      },
    });
    expect(result.suggestions.map(item => item.image)).toHaveLength(3);
    expect(result.trending).toEqual(['nike shoes', 'Puma']);
  });

  it('keeps recent searches newest first, without repeats, in the mock backend', async () => {
    const { customerSearchProductFixtureAdapter, resetRecentSearchesFixture } = require('@mocks/customerSearchProductAdapter');
    resetRecentSearchesFixture();
    const call = (method, data) => customerSearchProductFixtureAdapter({ url: '/search/recent', method, data });
    await call('post', { query: 'boat earbuds' });
    await call('post', { query: 'running shoes' });
    const again = await call('post', { query: 'Boat Earbuds' });
    expect(again.data.data.items).toEqual(['Boat Earbuds', 'running shoes']);
    expect((await call('delete')).data.data.cleared).toBe(true);
    expect((await call('get')).data.data.items).toEqual([]);
  });
});
