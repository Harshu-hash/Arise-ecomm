import { searchHistoryStorage } from './searchHistoryStorage';

describe('searchHistoryStorage', () => {
  beforeEach(() => searchHistoryStorage.clear());

  it('stores newest searches first and removes case-insensitive duplicates', () => {
    searchHistoryStorage.add('Shoes');
    searchHistoryStorage.add('shirts');
    const recent = searchHistoryStorage.add('shoes');

    expect(recent).toEqual(['shoes', 'shirts']);
    expect(searchHistoryStorage.get()).toEqual(recent);
  });

  it('keeps at most eight valid entries', () => {
    for (let index = 0; index < 10; index += 1) searchHistoryStorage.add(`query ${index}`);

    expect(searchHistoryStorage.get()).toHaveLength(8);
    expect(searchHistoryStorage.get()[0]).toBe('query 9');
  });
});
