import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../../constants/colors';
import { SPACING, RADIUS } from '../../../constants/spacing';
import {
  StatusBarManager,
  BottomSheetModal,
  PriceBlock,
  RatingBadge,
} from '../../../shared/components';
import ErrorState from '../../../shared/ErrorState/ErrorState';
import { useSearchProductsQuery } from '../api/search.query';
import {
  useAddWishlistItemMutation,
  useGetWishlistQuery,
  useRemoveWishlistItemMutation,
} from '@features/wishlist';
import { useToast } from '../../../contexts/ToastContext';

const EMPTY_FILTERS = { categories: [], brands: [], priceRangeId: null, minRating: null };

const discountPct = product =>
  product.mrp && product.mrp > product.price
    ? Math.round(((product.mrp - product.price) / product.mrp) * 100)
    : 0;

const ResultCard = ({ product, wishlisted, onToggleWishlist, onPress }) => {
  const pct = discountPct(product);
  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={styles.card}>
      <View style={styles.imageBox}>
        <Image source={{ uri: product.image }} style={styles.image} resizeMode="cover" />

        {pct > 0 ? (
          <View style={styles.discountBadge}>
            <Text style={styles.discountBadgeText}>{pct}% OFF</Text>
          </View>
        ) : null}

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onToggleWishlist}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.heartBtn}
        >
          <Icon
            name="heart"
            size={16}
            color={wishlisted ? COLORS.offerRed : COLORS.textTertiary}
            style={wishlisted ? undefined : { marginTop: -1 }}
          />
        </TouchableOpacity>
      </View>

      <Text style={styles.name} numberOfLines={2}>
        {product.name}
      </Text>

      <View style={styles.ratingRow}>
        <RatingBadge variant="pill" rating={product.rating} />
        {product.assured ? (
          <View style={styles.assuredRow}>
            <Icon name="shield" size={11} color={COLORS.primary} />
            <Text style={styles.assuredText}>Assured</Text>
          </View>
        ) : null}
      </View>

      <PriceBlock price={product.price} mrp={product.mrp} style={styles.priceBlock} />
      <Text style={styles.delivery}>{`Delivery by ${product.deliveryDate}`}</Text>
    </TouchableOpacity>
  );
};

const SearchResultsScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const query = route?.params?.query || '';
  const categoryId = route?.params?.categoryId;
  const brandId = route?.params?.brandId;

  const [sortId, setSortId] = useState('relevance');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [draftFilters, setDraftFilters] = useState(EMPTY_FILTERS);
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  const [cursor, setCursor] = useState(null);
  const [results, setResults] = useState([]);
  const toast = useToast();
  const { data: wishlistData } = useGetWishlistQuery();
  const [addWishlistItem] = useAddWishlistItemMutation();
  const [removeWishlistItem] = useRemoveWishlistItemMutation();
  const wishlistIds = useMemo(
    () => new Set((wishlistData?.items ?? []).map(item => item.id)),
    [wishlistData?.items],
  );

  const requestKey = useMemo(
    () => JSON.stringify({ query, categoryId, brandId, filters, sortId }),
    [brandId, categoryId, filters, query, sortId],
  );
  const requestArgs = useMemo(
    () => ({
      q: query,
      categoryId,
      brandId,
      categories: filters.categories.join(','),
      brands: filters.brands.join(','),
      priceRangeId: filters.priceRangeId || undefined,
      minRating: filters.minRating || undefined,
      sort: sortId,
      cursor: cursor || undefined,
      limit: 12,
    }),
    [brandId, categoryId, cursor, filters, query, sortId],
  );
  const { data, error, isLoading, isFetching, refetch } = useSearchProductsQuery(requestArgs);

  useEffect(() => {
    setCursor(null);
    setResults([]);
  }, [requestKey]);

  useEffect(() => {
    if (!data) return;
    setResults(previous => {
      const next = cursor ? [...previous, ...data.items] : data.items;
      return [...new Map(next.map(item => [item.id, item])).values()];
    });
  }, [cursor, data]);

  const categoryFilters = data?.facets.categories ?? [];
  const brandFilters = data?.facets.brands ?? [];
  const ratingFilters = data?.facets.ratings ?? [];
  const priceRangeFilters = data?.facets.priceRanges ?? [];
  const sortOptions = data?.sortOptions ?? [];

  const activeFilterCount =
    filters.categories.length +
    filters.brands.length +
    (filters.priceRangeId ? 1 : 0) +
    (filters.minRating ? 1 : 0);

  const toggleWishlist = async id => {
    const isWishlisted = wishlistIds.has(id);
    try {
      await (isWishlisted ? removeWishlistItem(id) : addWishlistItem(id)).unwrap();
    } catch (mutationError) {
      toast.show(mutationError.message || 'Could not update your wishlist.');
    }
  };

  const openFilterSheet = () => {
    setDraftFilters(filters);
    setFilterSheetVisible(true);
  };

  const toggleDraft = (key, value) => {
    setDraftFilters(prev => {
      const list = prev[key];
      const next = list.includes(value) ? list.filter(v => v !== value) : [...list, value];
      return { ...prev, [key]: next };
    });
  };

  const applyDraftFilters = () => {
    setFilters(draftFilters);
    setFilterSheetVisible(false);
  };

  const clearDraftFilters = () => setDraftFilters(EMPTY_FILTERS);

  const removeFilter = (key, value) => {
    setFilters(prev => {
      if (key === 'priceRangeId' || key === 'minRating') return { ...prev, [key]: null };
      return { ...prev, [key]: prev[key].filter(v => v !== value) };
    });
  };

  const appliedChips = [
    ...filters.categories.map(category => ({
      key: 'categories',
      value: category,
      label: category,
    })),
    ...filters.brands.map(brand => ({ key: 'brands', value: brand, label: brand })),
    ...(filters.priceRangeId
      ? [
          {
            key: 'priceRangeId',
            value: filters.priceRangeId,
            label: priceRangeFilters.find(range => range.id === filters.priceRangeId)?.label,
          },
        ]
      : []),
    ...(filters.minRating
      ? [{ key: 'minRating', value: filters.minRating, label: `${filters.minRating}+ rating` }]
      : []),
  ];

  return (
    <View style={styles.container}>
      <StatusBarManager barStyle="dark-content" themeColor={COLORS.primaryLight} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity onPress={() => navigation && navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.searchBar}
          onPress={() => navigation && navigation.navigate('Search', { initialQuery: query })}
        >
          <Icon
            name="search"
            size={16}
            color={COLORS.textSecondary}
            style={{ marginRight: SPACING.s }}
          />
          <Text style={styles.searchBarText} numberOfLines={1}>
            {query || 'Search for items...'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => navigation && navigation.navigate('Cart')}
          style={styles.cartBtn}
        >
          <Icon name="shopping-cart" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Sort bar */}
      <View style={styles.sortBarWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.sortBar}
        >
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={openFilterSheet}
            style={[styles.sortChip, activeFilterCount > 0 && styles.sortChipActive]}
          >
            <Icon
              name="sliders"
              size={13}
              color={activeFilterCount > 0 ? COLORS.primary : COLORS.textPrimary}
            />
            <Text style={[styles.sortChipText, activeFilterCount > 0 && styles.sortChipTextActive]}>
              Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
            </Text>
          </TouchableOpacity>

          {sortOptions.map(opt => (
            <TouchableOpacity
              key={opt.id}
              activeOpacity={0.8}
              onPress={() => setSortId(opt.id)}
              style={[styles.sortChip, sortId === opt.id && styles.sortChipActive]}
            >
              <Text style={[styles.sortChipText, sortId === opt.id && styles.sortChipTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Applied filter chips */}
      {appliedChips.length > 0 ? (
        <View style={styles.appliedWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.appliedRow}
          >
            {appliedChips.map(chip => (
              <TouchableOpacity
                key={`${chip.key}-${chip.value}`}
                activeOpacity={0.8}
                onPress={() => removeFilter(chip.key, chip.value)}
                style={styles.appliedChip}
              >
                <Text style={styles.appliedChipText} numberOfLines={1}>
                  {chip.label}
                </Text>
                <Icon name="x" size={12} color={COLORS.primary} style={{ marginLeft: 4 }} />
              </TouchableOpacity>
            ))}
            <TouchableOpacity activeOpacity={0.8} onPress={() => setFilters(EMPTY_FILTERS)}>
              <Text style={styles.clearAllText}>Clear All</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      ) : null}

      {/* Results */}
      <Text style={styles.resultCount}>
        {data?.total ?? results.length} result{(data?.total ?? results.length) !== 1 ? 's' : ''}
        {query ? ` for "${query}"` : ''}
      </Text>

      {isLoading && results.length === 0 ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : error && results.length === 0 ? (
        <ErrorState message={error.message} onRetry={refetch} />
      ) : results.length === 0 ? (
        <ScrollView contentContainerStyle={styles.emptyWrap} showsVerticalScrollIndicator={false}>
          <Icon name="search" size={44} color={COLORS.border} />
          <Text style={styles.emptyTitle}>No results found</Text>
          <Text style={styles.emptySubtitle}>
            {activeFilterCount > 0
              ? 'Try removing some filters to see more results.'
              : `We couldn't find any matches for "${query}". Try a different search.`}
          </Text>
          {activeFilterCount > 0 ? (
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.clearFiltersBtn}
              onPress={() => setFilters(EMPTY_FILTERS)}
            >
              <Text style={styles.clearFiltersText}>Clear Filters</Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>
      ) : (
        <FlatList
          data={results}
          keyExtractor={item => item.id}
          numColumns={2}
          showsVerticalScrollIndicator={false}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={styles.gridContent}
          refreshing={isFetching && !cursor}
          onRefresh={() => {
            setCursor(null);
            setResults([]);
            if (!cursor) refetch();
          }}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (data?.nextCursor && !isFetching) setCursor(data.nextCursor);
          }}
          ListFooterComponent={
            isFetching && cursor ? <ActivityIndicator color={COLORS.primary} /> : null
          }
          renderItem={({ item }) => (
            <ResultCard
              product={item}
              wishlisted={wishlistIds.has(item.id)}
              onToggleWishlist={() => toggleWishlist(item.id)}
              onPress={() => navigation?.navigate('ProductDetail', { productId: item.id })}
            />
          )}
        />
      )}

      {/* Filter sheet */}
      <BottomSheetModal visible={filterSheetVisible} onClose={() => setFilterSheetVisible(false)}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Filters</Text>
          <TouchableOpacity onPress={clearDraftFilters}>
            <Text style={styles.sheetClearText}>Clear All</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.sheetScroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.filterSectionTitle}>Category</Text>
          <View style={styles.filterChipsRow}>
            {categoryFilters.map(cat => (
              <TouchableOpacity
                key={cat}
                activeOpacity={0.8}
                onPress={() => toggleDraft('categories', cat)}
                style={[
                  styles.filterChip,
                  draftFilters.categories.includes(cat) && styles.filterChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    draftFilters.categories.includes(cat) && styles.filterChipTextActive,
                  ]}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.filterSectionTitle}>Price Range</Text>
          {priceRangeFilters.map(range => (
            <TouchableOpacity
              key={range.id}
              activeOpacity={0.7}
              style={styles.radioRow}
              onPress={() =>
                setDraftFilters(prev => ({
                  ...prev,
                  priceRangeId: prev.priceRangeId === range.id ? null : range.id,
                }))
              }
            >
              <View
                style={[styles.radio, draftFilters.priceRangeId === range.id && styles.radioActive]}
              >
                {draftFilters.priceRangeId === range.id ? <View style={styles.radioDot} /> : null}
              </View>
              <Text style={styles.radioLabel}>{range.label}</Text>
            </TouchableOpacity>
          ))}

          <Text style={styles.filterSectionTitle}>Customer Rating</Text>
          {ratingFilters.map(r => (
            <TouchableOpacity
              key={r.id}
              activeOpacity={0.7}
              style={styles.radioRow}
              onPress={() =>
                setDraftFilters(prev => ({
                  ...prev,
                  minRating: prev.minRating === r.value ? null : r.value,
                }))
              }
            >
              <View
                style={[styles.radio, draftFilters.minRating === r.value && styles.radioActive]}
              >
                {draftFilters.minRating === r.value ? <View style={styles.radioDot} /> : null}
              </View>
              <Text style={styles.radioLabel}>{r.label}</Text>
            </TouchableOpacity>
          ))}

          <Text style={styles.filterSectionTitle}>Brand</Text>
          <View style={styles.filterChipsRow}>
            {brandFilters.map(brand => (
              <TouchableOpacity
                key={brand}
                activeOpacity={0.8}
                onPress={() => toggleDraft('brands', brand)}
                style={[
                  styles.filterChip,
                  draftFilters.brands.includes(brand) && styles.filterChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    draftFilters.brands.includes(brand) && styles.filterChipTextActive,
                  ]}
                >
                  {brand}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={{ height: SPACING.xl }} />
        </ScrollView>

        <View style={[styles.sheetFooter, { paddingBottom: Math.max(insets.bottom, SPACING.l) }]}>
          <TouchableOpacity activeOpacity={0.9} style={styles.applyBtn} onPress={applyDraftFilters}>
            <Text style={styles.applyBtnText}>Apply Filters</Text>
          </TouchableOpacity>
        </View>
      </BottomSheetModal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: SPACING.l,
    paddingBottom: SPACING.m,
    gap: SPACING.s,
  },
  backBtn: {
    padding: 2,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.round,
    paddingHorizontal: SPACING.m,
    height: 40,
  },
  searchBarText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  cartBtn: {
    padding: 2,
  },
  sortBarWrap: {
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  sortBar: {
    paddingHorizontal: SPACING.l,
    paddingVertical: SPACING.s,
    gap: SPACING.s,
  },
  sortChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.round,
    paddingHorizontal: SPACING.m,
    paddingVertical: 7,
    gap: 6,
  },
  sortChipActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  sortChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  sortChipTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  appliedWrap: {
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  appliedRow: {
    paddingHorizontal: SPACING.l,
    paddingVertical: SPACING.s,
    alignItems: 'center',
    gap: SPACING.s,
  },
  appliedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.round,
    paddingHorizontal: SPACING.m,
    paddingVertical: 6,
    maxWidth: 160,
  },
  appliedChipText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: COLORS.primary,
  },
  clearAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.error,
    marginLeft: SPACING.xs,
  },
  resultCount: {
    fontSize: 12,
    color: COLORS.textSecondary,
    paddingHorizontal: SPACING.l,
    paddingVertical: SPACING.s,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridContent: {
    paddingHorizontal: SPACING.l,
    paddingBottom: SPACING.xxxl,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    marginBottom: SPACING.l,
  },
  card: {
    width: '48%',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.m,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: SPACING.s,
  },
  imageBox: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: COLORS.mutedBg,
    borderRadius: RADIUS.s,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: SPACING.s,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  discountBadge: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    backgroundColor: COLORS.ratingGreen,
    borderRadius: RADIUS.xs,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  discountBadgeText: {
    color: COLORS.white,
    fontSize: 9.5,
    fontWeight: '800',
  },
  heartBtn: {
    position: 'absolute',
    right: 6,
    top: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  name: {
    fontSize: 12.5,
    color: COLORS.textPrimary,
    lineHeight: 16,
    minHeight: 32,
    marginBottom: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.s,
    marginBottom: 4,
  },
  assuredRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  assuredText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: COLORS.primary,
    marginLeft: 2,
  },
  priceBlock: {
    marginBottom: 2,
  },
  delivery: {
    fontSize: 10.5,
    color: COLORS.textSecondary,
  },
  emptyWrap: {
    flexGrow: 1,
    alignItems: 'center',
    paddingTop: SPACING.xxxl,
    paddingHorizontal: SPACING.xl,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: SPACING.l,
  },
  emptySubtitle: {
    fontSize: 12.5,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.xs,
    lineHeight: 18,
  },
  clearFiltersBtn: {
    marginTop: SPACING.l,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: RADIUS.s,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.s + 2,
  },
  clearFiltersText: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  emptyTrendingTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: SPACING.xxl,
    marginBottom: SPACING.m,
    alignSelf: 'flex-start',
  },
  emptyTrendingChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.s,
  },
  trendingChip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.round,
    paddingHorizontal: SPACING.m,
    paddingVertical: 7,
  },
  trendingChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.l,
    paddingVertical: SPACING.l,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  sheetClearText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.error,
  },
  sheetScroll: {
    paddingHorizontal: SPACING.l,
  },
  filterSectionTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: SPACING.xl,
    marginBottom: SPACING.m,
  },
  filterChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.s,
  },
  filterChip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.round,
    paddingHorizontal: SPACING.m,
    paddingVertical: 7,
  },
  filterChipActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  filterChipTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.s,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.m,
  },
  radioActive: {
    borderColor: COLORS.primary,
  },
  radioDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: COLORS.primary,
  },
  radioLabel: {
    fontSize: 13.5,
    color: COLORS.textPrimary,
  },
  sheetFooter: {
    paddingHorizontal: SPACING.l,
    paddingTop: SPACING.m,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  applyBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.s,
    paddingVertical: SPACING.m,
    alignItems: 'center',
  },
  applyBtnText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 15,
  },
});

export default SearchResultsScreen;
