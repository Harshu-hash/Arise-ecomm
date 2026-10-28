import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Image, Easing } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../../constants/colors';
import { SPACING, RADIUS } from '../../../constants/spacing';
import { GradientBackground, TopBrandTabs, CategoryTabStrip, AnimatedSearchPlaceholder, DribbleFlipImage } from '../../../shared/components';
import { BRAND_TABS, CATEGORY_TABS, SEARCH_PLACEHOLDERS } from '../data/homeData';

const DEFAULT_TOP_PORTION_HEIGHT = 100;
const DEFAULT_REST_HEIGHT = 132; // search bar + category strip + their margins/padding
const DEFAULT_GRADIENT = ['#FFCB9D', '#FFFFFF'];
const GRADIENT_FADE_DURATION = 380;

const getGradientForCategory = (categoryId) =>
  CATEGORY_TABS.find((tab) => tab.id === categoryId)?.gradient || DEFAULT_GRADIENT;

/**
 * Home top zone: campaign gradient + brand tabs + location row + search bar + category strip.
 * Rendered as a `position: absolute` overlay above the page ScrollView. The whole header
 * translates up (native-driver transform only — no layout/height animation, so it stays
 * smooth) as `scrollY` increases, clamped once the brand-tabs/location row has moved fully
 * out of view — at that point the search bar + category strip (the same elements throughout,
 * never duplicated) are simply what's left on screen, pinned at the top.
 */
const LocationSearchHeader = ({
  address,
  onAddressPress,
  onSearchPress,
  onScanPress,
  onCouponPress,
  onWalletPress,
  activeCategoryId,
  onSelectCategory,
  activeBrandId = 'flipkart',
  onBrandSelect,
  scrollY,
  onHeaderHeight,
}) => {
  const insets = useSafeAreaInsets();
  const topPaddingValue = Math.max(insets.top, 12);
  const [topPortionHeight, setTopPortionHeight] = useState(DEFAULT_TOP_PORTION_HEIGHT);
  const [restHeight, setRestHeight] = useState(DEFAULT_REST_HEIGHT);
  const measuredTopRef = useRef(false);
  const measuredRestRef = useRef(false);

  const [baseGradient, setBaseGradient] = useState(() => getGradientForCategory(activeCategoryId));
  const [incomingGradient, setIncomingGradient] = useState(null);
  const gradientFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const nextGradient = getGradientForCategory(activeCategoryId);
    if (nextGradient[0] === baseGradient[0] && nextGradient[1] === baseGradient[1]) return;

    setIncomingGradient(nextGradient);
    gradientFade.setValue(0);
    Animated.timing(gradientFade, {
      toValue: 1,
      duration: GRADIENT_FADE_DURATION,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setBaseGradient(nextGradient);
        setIncomingGradient(null);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategoryId]);

  // Derived (never independently measured) so it can never drift out of sync with the
  // translateY clamp below — that mismatch was what left a leftover strip of orange
  // background once collapsed.
  const fullHeight = topPaddingValue + topPortionHeight + restHeight;

  useEffect(() => {
    onHeaderHeight && onHeaderHeight(fullHeight);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullHeight]);

  const translateY = scrollY.interpolate({
    inputRange: [0, topPortionHeight],
    outputRange: [0, -topPortionHeight],
    extrapolate: 'clamp',
  });
  const topPortionOpacity = scrollY.interpolate({
    inputRange: [0, topPortionHeight * 0.7],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const handleTopPortionLayout = (e) => {
    if (measuredTopRef.current) return;
    measuredTopRef.current = true;
    setTopPortionHeight(e.nativeEvent.layout.height);
  };

  const handleRestLayout = (e) => {
    if (measuredRestRef.current) return;
    measuredRestRef.current = true;
    setRestHeight(e.nativeEvent.layout.height);
  };

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY }] }]}>
      <GradientBackground colors={baseGradient} />
      {incomingGradient && (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: gradientFade }]}>
          <GradientBackground colors={incomingGradient} />
        </Animated.View>
      )}

      <View style={{ paddingTop: topPaddingValue }}>
        <Animated.View onLayout={handleTopPortionLayout} style={{ opacity: topPortionOpacity }}>
          <TopBrandTabs tabs={BRAND_TABS} activeId={activeBrandId} onSelect={onBrandSelect} />

          <View style={styles.locationRow}>
            <TouchableOpacity activeOpacity={0.8} onPress={onAddressPress} style={styles.addressBtn}>
              <Icon name="map-pin" size={15} color={COLORS.textPrimary} />
              <Text style={styles.addressText} numberOfLines={1}>{address}</Text>
              <Icon name="chevron-down" size={14} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.8} onPress={onCouponPress} style={styles.couponPill}>
              <DribbleFlipImage
                source={require('../../../assets/images/Coupon.png')}
                style={styles.couponIcon}
              />
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.8} onPress={onWalletPress} style={styles.coinPill}>
              <Image
                source={require('../../../assets/images/coin-image.png')}
                style={styles.coinIcon}
                resizeMode="contain"
              />
              <Text style={styles.coinText}>0</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        <View onLayout={handleRestLayout} style={styles.restBlock}>
          <TouchableOpacity activeOpacity={0.9} onPress={onSearchPress} style={styles.searchBar}>
            <Icon name="search" size={18} color={COLORS.textSecondary} style={{ marginRight: SPACING.s }} />
            <AnimatedSearchPlaceholder phrases={SEARCH_PLACEHOLDERS} style={styles.searchPlaceholder} />
            <Icon name="camera" size={17} color={COLORS.textSecondary} style={{ marginRight: SPACING.s }} />
            <Icon name="mic" size={17} color={COLORS.textSecondary} />
          </TouchableOpacity>

          <CategoryTabStrip
            tabs={CATEGORY_TABS}
            activeId={activeCategoryId}
            onSelect={onSelectCategory}
            style={styles.categoryStrip}
            scrollY={scrollY}
            collapseDistance={topPortionHeight}
          />
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    elevation: 20,
    backgroundColor: '#FFFFFF', // Safe fallback to fill any rendering gaps, matches gradient end
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.l,
    marginTop: SPACING.m,
  },
  addressBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.85)',
    paddingHorizontal: SPACING.m,
    paddingVertical: 7,
    borderRadius: 20,
    marginRight: SPACING.s,
    gap: 6,
  },
  addressText: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '400',
    color: COLORS.textPrimary,
  },
  coinPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: SPACING.s,
    paddingVertical: 7,
    borderRadius: 16,
    gap: 4,
  },
  coinIcon: {
    width: 14,
    height: 14,
  },
  couponPill: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    width: 34,
    height: 34,
    borderRadius: 16,
    marginRight: SPACING.s,
  },
  couponIcon: {
    width: 18,
    height: 18,
  },
  coinText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.l,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    paddingHorizontal: SPACING.m,
    height: 46,
    marginHorizontal: SPACING.l,
    marginTop: SPACING.m,
  },
  searchPlaceholder: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.textSecondary,
  },
  categoryStrip: {
    marginTop: SPACING.xs,
    width: '100%',
  },
  restBlock: {
    paddingBottom: SPACING.xs,
  },
});

export default LocationSearchHeader;
