import React, { useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { Animated, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS } from '../../../constants/colors';
import { RADIUS, SPACING } from '../../../constants/spacing';
import { StatusBarManager } from '../../../shared/components';
import ErrorState from '../../../shared/ErrorState/ErrorState';
import EmptyState from '../../../shared/EmptyState/EmptyState';
import LocationSearchHeader from '../components/LocationSearchHeader';
import HeroBannerCarousel from '../components/HeroBannerCarousel';
import AdSheetCard from '../components/AdSheetCard';
import RecentlyViewedRail from '../components/RecentlyViewedRail';
import AdTileRow from '../components/AdTileRow';
import FlashSaleBanner from '../components/FlashSaleBanner';
import SuggestedForYouSection from '../components/SuggestedForYouSection';
import BrandsSpotlightSection from '../components/BrandsSpotlightSection';
import TopValueDealsSection from '../components/TopValueDealsSection';
import ProductFeedSection from '../components/ProductFeedSection';
import AddressSelectSheet from '../components/AddressSelectSheet';
import HomeScreenSkeleton from '../components/HomeScreenSkeleton';
import { useGetHomeQuery } from '../api/home.query';
import { useGetAddressesQuery } from '@features/address';
import { selectIsAuthenticated } from '@features/auth';

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
  const { data, error, isLoading, isFetching, refetch } = useGetHomeQuery();
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const { data: addressBook } = useGetAddressesQuery(undefined, { skip: !isAuthenticated });
  const [activeCategoryId, setActiveCategoryId] = useState(null);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [isAddressSheetVisible, setIsAddressSheetVisible] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(DEFAULT_HEADER_HEIGHT);
  const scrollY = useRef(new Animated.Value(0)).current;

  if (isLoading) return <HomeScreenSkeleton />;
  if (error || !data) {
    return <ErrorState message={error?.message} onRetry={refetch} />;
  }

  const hasContent =
    data.heroBanners.length > 0 ||
    data.adBanners.length > 0 ||
    data.recentlyViewed.length > 0 ||
    data.adTiles.length > 0 ||
    data.showFlashSale ||
    data.suggestedProducts.length > 0 ||
    data.brandsSpotlight.length > 0 ||
    data.topValueDeals.length > 0 ||
    data.productFeed.length > 0;

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
  const handleScroll = Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
    useNativeDriver: true,
  });
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
        {data.heroBanners.length > 0 ? <HeroBannerCarousel banners={data.heroBanners} /> : null}

        <Animated.View style={{ transform: [{ translateY: adSheetParallaxY }] }}>
          {data.failedSections.length > 0 ? (
            <SectionLoadWarning count={data.failedSections.length} onRetry={refetch} />
          ) : null}
          {data.adBanners.length > 0 ? <AdSheetCard banners={data.adBanners} /> : null}
          {data.recentlyViewed.length > 0 ? (
            <RecentlyViewedRail
              items={data.recentlyViewed}
              onPressItem={item =>
                navigation?.navigate('Category', { category: { name: item.title } })
              }
              onSeeAll={() => navigation?.navigate('RecentlyViewed')}
            />
          ) : null}
          {data.showFlashSale ? (
            <FlashSaleBanner onPress={() => navigation?.navigate('FlashSale')} />
          ) : null}
          {data.adTiles.length > 0 ? (
            <AdTileRow tiles={data.adTiles} onPressTile={() => navigation?.navigate('Offers')} />
          ) : null}
          {data.suggestedProducts.length > 0 ? (
            <SuggestedForYouSection
              products={data.suggestedProducts}
              onPressProduct={product => navigation?.navigate('ProductDetail', { product })}
              onSeeAll={() => navigation?.navigate('SearchResults', {})}
            />
          ) : null}
          {data.brandsSpotlight.length > 0 ? (
            <BrandsSpotlightSection
              brands={data.brandsSpotlight}
              onPressBrand={brand => navigation?.navigate('Brands', { brandId: brand.id })}
              onSeeAll={() => navigation?.navigate('Brands')}
            />
          ) : null}
          {data.topValueDeals.length > 0 ? (
            <TopValueDealsSection
              deals={data.topValueDeals}
              onPressDeal={deal => navigation?.navigate('DealDetail', { deal })}
            />
          ) : null}
          {data.productFeed.length > 0 ? (
            <ProductFeedSection
              products={data.productFeed}
              onPressProduct={product => navigation?.navigate('ProductDetail', { product })}
            />
          ) : null}
        </Animated.View>
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
  retryText: { color: COLORS.primary, fontWeight: '700', marginLeft: SPACING.m },
});

export default HomeScreen;
