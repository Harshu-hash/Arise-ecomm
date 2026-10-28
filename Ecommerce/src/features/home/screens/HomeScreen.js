import React, { useState, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { COLORS } from '../../../constants/colors';
import { StatusBarManager } from '../../../shared/components';
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
import {
  HERO_BANNERS,
  AD_BANNERS,
  RECENTLY_VIEWED,
  AD_TILES,
  SUGGESTED_PRODUCTS,
  BRANDS_SPOTLIGHT,
  TOP_VALUE_DEALS,
  PRODUCT_FEED,
  CATEGORY_TABS,
  SAVED_ADDRESSES,
} from '../data/homeData';

const DEFAULT_HEADER_HEIGHT = 272;
// Ad sheet climbs this many extra px (beyond normal scroll movement) over this much
// scroll distance, so it visually overlaps further onto the hero banner as you scroll.
const AD_SHEET_PARALLAX_DISTANCE = 50;
const AD_SHEET_PARALLAX_SCROLL_RANGE = 160;

const HomeScreen = ({ navigation }) => {
  const [activeCategoryId, setActiveCategoryId] = useState(CATEGORY_TABS[0].id);
  const [selectedAddressId, setSelectedAddressId] = useState(SAVED_ADDRESSES[0].id);
  const [isAddressSheetVisible, setIsAddressSheetVisible] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(DEFAULT_HEADER_HEIGHT);

  const selectedAddress = SAVED_ADDRESSES.find((a) => a.id === selectedAddressId) || SAVED_ADDRESSES[0];

  // Shared with LocationSearchHeader (a position:absolute overlay) so it can translate
  // itself up as the page scrolls — purely transform/opacity, native-driver, no jank.
  // Everything derived from this stays in lockstep since it's all one native-driven value
  // (a second, JS-driven value was tried for the category row's own height animation, but
  // that could desync from this one under fast scrolling and leave a visible gap — do not
  // reintroduce it; see the note in CategoryTabStrip.js).
  const scrollY = useRef(new Animated.Value(0)).current;
  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: true }
  );

  const adSheetParallaxY = scrollY.interpolate({
    inputRange: [0, AD_SHEET_PARALLAX_SCROLL_RANGE],
    outputRange: [0, -AD_SHEET_PARALLAX_DISTANCE],
    extrapolate: 'clamp',
  });

  const handleSearchPress = () => navigation && navigation.navigate('Search');
  const handleCouponPress = () => navigation && navigation.navigate('Coupons');
  const handleWalletPress = () => navigation && navigation.navigate('Wallet');
  const handleSelectCategory = (tab) => setActiveCategoryId(tab.id);
  const handleBrandSelect = (tab) => {
    if (tab.id === 'value365') {
      navigation && navigation.navigate('Offers');
    }
  };

  const handleAddressPress = () => setIsAddressSheetVisible(true);
  const handleCloseAddressSheet = () => setIsAddressSheetVisible(false);
  const handleSelectAddress = (addr) => {
    setSelectedAddressId(addr.id);
    setIsAddressSheetVisible(false);
  };

  return (
    <View style={styles.container}>
      <StatusBarManager barStyle="dark-content" themeColor="#FFCB9D" />

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingTop: headerHeight }]}
        onScroll={handleScroll}
        scrollEventThrottle={16}>
        <HeroBannerCarousel banners={HERO_BANNERS} />

        {/*
          Everything below the hero banner moves together as ONE block with an extra
          upward translateY (native-driven, on top of normal scroll movement) that grows
          with scroll distance — so the ad sheet visually climbs up and increasingly
          overlaps the hero banner above it, while its own spacing to the sections below
          stays exactly as laid out (they're all shifted by the same amount, together).
          Wrapping only the ad sheet by itself left a gap below it, since the sections
          after it — outside that transform — stayed at their normal, un-shifted position.
        */}
        <Animated.View style={{ transform: [{ translateY: adSheetParallaxY }] }}>
          <AdSheetCard banners={AD_BANNERS} />

          <RecentlyViewedRail
            items={RECENTLY_VIEWED}
            onPressItem={(item) => navigation && navigation.navigate('Category', { category: { name: item.title } })}
            onSeeAll={() => navigation && navigation.navigate('RecentlyViewed')}
          />

          <FlashSaleBanner onPress={() => navigation && navigation.navigate('FlashSale')} />

          <AdTileRow tiles={AD_TILES} onPressTile={() => navigation && navigation.navigate('Offers')} />

          <SuggestedForYouSection
            products={SUGGESTED_PRODUCTS}
            onPressProduct={(product) => navigation && navigation.navigate('ProductDetail', { product })}
            onSeeAll={() => navigation && navigation.navigate('SearchResults', {})}
          />

          <BrandsSpotlightSection
            brands={BRANDS_SPOTLIGHT}
            onPressBrand={() => {}}
            onSeeAll={() => navigation && navigation.navigate('Brands')}
          />

          <TopValueDealsSection
            deals={TOP_VALUE_DEALS}
            onPressDeal={(deal) => navigation && navigation.navigate(deal ? 'DealDetail' : 'Offers', deal ? { deal } : undefined)}
          />

          <ProductFeedSection
            products={PRODUCT_FEED}
            onPressProduct={(product) => navigation && navigation.navigate('ProductDetail', { product })}
          />
        </Animated.View>
      </Animated.ScrollView>

      <LocationSearchHeader
        address={selectedAddress.address}
        onAddressPress={handleAddressPress}
        onSearchPress={handleSearchPress}
        onScanPress={() => {}}
        onCouponPress={handleCouponPress}
        onWalletPress={handleWalletPress}
        activeCategoryId={activeCategoryId}
        onSelectCategory={handleSelectCategory}
        activeBrandId="flipkart"
        onBrandSelect={handleBrandSelect}
        scrollY={scrollY}
        onHeaderHeight={setHeaderHeight}
      />

      <AddressSelectSheet
        visible={isAddressSheetVisible}
        onClose={handleCloseAddressSheet}
        addresses={SAVED_ADDRESSES}
        selectedId={selectedAddressId}
        onSelectAddress={handleSelectAddress}
        onAddNew={handleCloseAddressSheet}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingBottom: 24,
  },
});

export default HomeScreen;
