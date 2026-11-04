export { default as SearchScreen } from './screens/SearchScreen';
export { default as SearchResultsScreen } from './screens/SearchResultsScreen';
export {
  useGetSearchSuggestionsQuery,
  useLazyGetSearchSuggestionsQuery,
  useLazySearchProductsQuery,
  useSearchProductsQuery,
} from './api/search.query';
