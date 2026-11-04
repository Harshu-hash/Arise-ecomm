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
