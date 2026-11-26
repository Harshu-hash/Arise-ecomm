import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { ActivityIndicator, Animated, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS } from '../../../constants/colors';
import { RADIUS, SPACING } from '../../../constants/spacing';
import { StatusBarManager } from '../../../shared/components';
import ErrorState from '../../../shared/ErrorState/ErrorState';
import EmptyState from '../../../shared/EmptyState/EmptyState';
import LocationSearchHeader from '../components/LocationSearchHeader';
import HeroBannerCarousel from '../components/HeroBannerCarousel';
import AdSheetCard from '../components/AdSheetCard';
import RecentlyViewedRail from '../components/RecentlyViewedRail';
import FlashSaleBanner from '../components/FlashSaleBanner';
import SuggestedForYouSection from '../components/SuggestedForYouSection';
import BrandsSpotlightSection from '../components/BrandsSpotlightSection';
import TopValueDealsSection from '../components/TopValueDealsSection';
import ProductFeedSection from '../components/ProductFeedSection';
import AddressSelectSheet from '../components/AddressSelectSheet';
import HomeScreenSkeleton from '../components/HomeScreenSkeleton';
import { HOME_SECTION_TYPES } from '../api/home.mapper';
import { useGetHomeQuery, useLazyGetHomeFeedPageQuery } from '../api/home.query';
import { useGetAddressesQuery } from '@features/address';
import { selectIsAuthenticated } from '@features/auth';
import { categoryApi } from '@features/category';

const FOR_YOU_TAB_ID = 'foryou'; // reserved first tab served by the backend: the main home feed
const FEED_PAGE_SIZE = 20; // the first page /home sends; a shorter first page means there is nothing more
const LOAD_MORE_SCREENS = 3; // fetch the next page this many screen-heights before the end, so it lands before the shopper gets there
const DEFAULT_HEADER_HEIGHT = 272;
const AD_SHEET_PARALLAX_DISTANCE = 50;
const AD_SHEET_PARALLAX_SCROLL_RANGE = 160;
const EMPTY_DELIVERY_LOCATION = {
  id: 'select-address',
  label: 'Delivery address',
  icon: 'map-pin',
  address: 'Select a delivery address',
};

const SectionLoadWarning = ({ count, onRetry }) => (
  <View style={styles.sectionWarning} accessibilityRole="alert">
    <Text style={styles.sectionWarningText}>
      {count === 1 ? 'One section could not be loaded.' : `${count} sections could not be loaded.`}
    </Text>
    <TouchableOpacity onPress={onRetry} activeOpacity={0.7}>
      <Text style={styles.retryText}>Retry</Text>
    </TouchableOpacity>
  </View>
);

const HomeScreen = ({ navigation }) => {
  const [activeCategoryId, setActiveCategoryId] = useState(null);
  // `data` keeps the previous tab's response while a new tab loads, so the header never flashes away.
  const { data, currentData, error, isLoading, isFetching, refetch } = useGetHomeQuery(
    activeCategoryId && activeCategoryId !== FOR_YOU_TAB_ID ? activeCategoryId : undefined,
  );
  // "You May Also Like" grows by pages as the shopper nears the bottom; `key` ties the extra pages to the feed they extend,
  // so a tab switch or a refresh starts over from the first page /home sends.
  const [fetchFeedPage] = useLazyGetHomeFeedPageQuery();
  const [moreFeed, setMoreFeed] = useState({ key: null, items: [], cursor: null, done: false });
  const [loadingMore, setLoadingMore] = useState(false);
  const loadingMoreRef = useRef(false);
  const feedKey = `${activeCategoryId}|${data?.generatedAt}`;
  const extraFeed = moreFeed.key === feedKey ? moreFeed : { key: feedKey, items: [], cursor: null, done: false };
  const loadMoreFeed = async () => {
    const feed = currentData?.sections.find(section => section.type === HOME_SECTION_TYPES.productFeed);
    if (!feed || loadingMoreRef.current || extraFeed.done) return;
    if (feed.items.length < FEED_PAGE_SIZE) return setMoreFeed({ ...extraFeed, done: true });
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const page = await fetchFeedPage({
        categoryId: activeCategoryId && activeCategoryId !== FOR_YOU_TAB_ID ? activeCategoryId : undefined,
        cursor: extraFeed.cursor ?? String(feed.items.length),
      }).unwrap();
      setMoreFeed({ key: feedKey, items: [...extraFeed.items, ...page.items], cursor: page.nextCursor, done: !page.nextCursor });
    } catch {
      // Leave it retryable: the next scroll near the end tries again.
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  };
  // Warm the Categories tab without issuing one expensive Home request per header tab.
  const prefetchCategoryTree = categoryApi.usePrefetch('getCategoryTree');
  const prefetchCategory = categoryApi.usePrefetch('getCategory');
  const firstCategoryId = data?.header.categoryTabs?.find(tab => tab.id !== FOR_YOU_TAB_ID)?.id;
  useEffect(() => {
    if (!firstCategoryId) return;
    prefetchCategoryTree(undefined, { ifOlderThan: 60 });
    prefetchCategory(firstCategoryId, { ifOlderThan: 60 });
  }, [firstCategoryId, prefetchCategory, prefetchCategoryTree]);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  // Home is personal once signed in ("Still looking for these?"): reload it when the user signs in or out.
  const authSeen = useRef(isAuthenticated);
  useEffect(() => {
    if (authSeen.current === isAuthenticated) return;
    authSeen.current = isAuthenticated;
    refetch();
  }, [isAuthenticated, refetch]);
  const { data: addressBook } = useGetAddressesQuery(undefined, { skip: !isAuthenticated });
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [isAddressSheetVisible, setIsAddressSheetVisible] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(DEFAULT_HEADER_HEIGHT);
  const scrollY = useRef(new Animated.Value(0)).current;
  // The tab bar belongs to the navigator, outside this screen, so the sheet cannot be raised above it
  // with z-index; hide the bar while the sheet is open instead.
  useLayoutEffect(() => {
    navigation?.setOptions({ tabBarStyle: { display: isAddressSheetVisible ? 'none' : 'flex' } });
  }, [navigation, isAddressSheetVisible]);

  if (isLoading) return <HomeScreenSkeleton />;
  if (error || !data) {
    return <ErrorState message={error?.message} onRetry={refetch} />;
  }

  // `data` keeps the previous tab's page while the new one loads; don't show it as if it were this tab's.
  const switchingTab = !currentData && isFetching;
  const hasSections =
    data.heroBanners.length > 0 || data.adBanners.length > 0 || data.sections.length > 0;
  const hasContent = hasSections || data.header.categoryTabs.length > 0;

  if (!hasContent) {
    return (
      <EmptyState
        icon="shopping-bag"
        title="Nothing to show yet"
        message="New products and offers will appear here soon."
        actionLabel="Refresh"
        onActionPress={refetch}
      />
    );
  }

  const deliveryLocations = addressBook?.items ?? [];
  const selectedAddress =
    deliveryLocations.find(address => address.id === selectedAddressId) ||
    deliveryLocations.find(address => address.isDefault) ||
    deliveryLocations[0] ||
    EMPTY_DELIVERY_LOCATION;
  const resolvedCategoryId = activeCategoryId || data.header.categoryTabs[0]?.id;
  const activeBrandId = data.header.brandTabs[0]?.id;
  // A shop banner opens that seller's products; a product banner opens the product.
  const openBanner = banner => {
    if (banner.target?.type === 'PRODUCT') navigation?.navigate('ProductDetail', { productId: banner.target.id });
    else if (banner.target?.type === 'SHOP') navigation?.navigate('SearchResults', { sellerId: banner.target.id, title: 'Shop' });
  };
  const handleScroll = Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
    useNativeDriver: true,
    listener: ({ nativeEvent: { contentOffset, contentSize, layoutMeasurement } }) => {
      if (contentOffset.y + layoutMeasurement.height > contentSize.height - LOAD_MORE_SCREENS * layoutMeasurement.height) loadMoreFeed();
    },
  });
  // Below the pinned hero and ad banners, sections appear in the order the admin's published layout set.
  const renderSection = section => {
    switch (section.type) {
      case HOME_SECTION_TYPES.recentlyViewed:
        return (
          <RecentlyViewedRail
            key={section.id}
            items={section.items}
            onPressItem={item => navigation?.navigate('ProductDetail', { productId: item.id })}
            onSeeAll={() => navigation?.navigate('RecentlyViewed')}
          />
        );
      case HOME_SECTION_TYPES.flashSale:
        return section.items.map(sale => (
          <FlashSaleBanner
            key={`${section.id}-${sale.id}`}
            title={sale.title}
            subtitle={sale.subtitle}
            onPress={() => navigation?.navigate('FlashSale', { campaignId: sale.id })}
          />
        ));
      case HOME_SECTION_TYPES.suggestedProducts:
        return (
          <SuggestedForYouSection
            key={section.id}
            products={section.items}
            onPressProduct={product => navigation?.navigate('ProductDetail', { product })}
            onSeeAll={() => navigation?.navigate('SearchResults', {})}
          />
        );
      case HOME_SECTION_TYPES.brandSpotlight:
        return (
          <BrandsSpotlightSection
            key={section.id}
            brands={section.items}
            onPressBrand={brand => navigation?.navigate('SearchResults', { brandId: brand.id, query: brand.name })}
            onSeeAll={() => navigation?.navigate('Brands')}
          />
        );
      case HOME_SECTION_TYPES.topValueDeals:
        return (
          <TopValueDealsSection
            key={section.id}
            deals={section.items}
            onPressDeal={deal => navigation?.navigate('DealDetail', { dealId: deal.campaignId ?? deal.id, deal })}
          />
        );
      case HOME_SECTION_TYPES.productFeed:
        return (
          <ProductFeedSection
            key={section.id}
            products={[...section.items, ...extraFeed.items]}
            onPressProduct={product => navigation?.navigate('ProductDetail', { product })}
          />
        );
      default:
        return null;
    }
  };
  const adSheetParallaxY = scrollY.interpolate({
    inputRange: [0, AD_SHEET_PARALLAX_SCROLL_RANGE],
    outputRange: [0, -AD_SHEET_PARALLAX_DISTANCE],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.container}>
      <StatusBarManager barStyle="dark-content" themeColor="#FFCB9D" />
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingTop: headerHeight }]}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isLoading}
            onRefresh={refetch}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
      >
        {switchingTab ? <ActivityIndicator style={styles.tabLoader} color={COLORS.primary} /> : null}
        {!switchingTab && data.heroBanners.length > 0 ? <HeroBannerCarousel banners={data.heroBanners} /> : null}

        {switchingTab ? null : <Animated.View style={{ transform: [{ translateY: adSheetParallaxY }] }}>
          {data.failedSections.length > 0 ? (
            <SectionLoadWarning count={data.failedSections.length} onRetry={refetch} />
          ) : null}
          {data.adBanners.length > 0 ? <AdSheetCard banners={data.adBanners} onPressBanner={openBanner} /> : null}
          {data.sections.map(renderSection)}
          {!hasSections && !isFetching ? (
            <Text style={styles.emptyNote}>Nothing to show in this category yet.</Text>
          ) : null}
        </Animated.View>}
        {loadingMore ? <ActivityIndicator style={styles.moreLoader} color={COLORS.primary} /> : null}
      </Animated.ScrollView>

      <LocationSearchHeader
        address={selectedAddress.address}
        onAddressPress={() => setIsAddressSheetVisible(true)}
        onSearchPress={() => navigation?.navigate('Search')}
        onScanPress={() => {}}
        onCouponPress={() => navigation?.navigate('Coupons')}
        onWalletPress={() => navigation?.navigate('Wallet')}
        activeCategoryId={resolvedCategoryId}
        onSelectCategory={tab => setActiveCategoryId(tab.id)}
        activeBrandId={activeBrandId}
        onBrandSelect={tab => tab.id !== activeBrandId && navigation?.navigate('Offers')}
        scrollY={scrollY}
        onHeaderHeight={setHeaderHeight}
        brandTabs={data.header.brandTabs}
        categoryTabs={data.header.categoryTabs}
        searchPlaceholders={data.header.searchPlaceholders}
      />

      <AddressSelectSheet
        visible={isAddressSheetVisible}
        onClose={() => setIsAddressSheetVisible(false)}
        addresses={deliveryLocations}
        selectedId={selectedAddress.id}
        onSelectAddress={address => {
          setSelectedAddressId(address.id);
          setIsAddressSheetVisible(false);
        }}
        onAddNew={() => {
          setIsAddressSheetVisible(false);
          navigation?.navigate('AddEditAddress');
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { paddingBottom: 24 },
  sectionWarning: {
    margin: SPACING.l,
    padding: SPACING.m,
    borderRadius: RADIUS.m,
    backgroundColor: COLORS.offerRedLight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionWarningText: { flex: 1, color: COLORS.textPrimary, fontSize: 13 },
  tabLoader: { marginTop: 120 },
  moreLoader: { marginVertical: SPACING.l },
  emptyNote: { textAlign: 'center', color: COLORS.textSecondary, fontSize: 14, marginTop: 80 },
  retryText: { color: COLORS.primary, fontWeight: '700', marginLeft: SPACING.m },
});

export default HomeScreen;
