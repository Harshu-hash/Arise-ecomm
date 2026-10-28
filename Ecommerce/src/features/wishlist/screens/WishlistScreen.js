import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { COLORS } from '../../../constants/colors';
import { SPACING, RADIUS } from '../../../constants/spacing';
import {
  StatusBarManager,
  PriceBlock,
  RatingBadge,
  EmptyWishlistIllustration,
  HorizontalProductRail,
} from '../../../shared/components';
import PressableScale from '../../../shared/ui/PressableScale';
import { haptics } from '../../../utils/haptics';

const INITIAL_WISHLIST = [
  {
    id: 'w1',
    name: 'boAt Airdopes 141 Bluetooth Truly Wireless Earbuds',
    image: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=500&q=80',
    price: 1299,
    mrp: 4490,
    rating: 4.2,
    ratingCount: 128,
    inStock: true,
  },
  {
    id: 'w2',
    name: 'Samsung Galaxy M14 5G (ICY Silver, 128 GB)',
    image: 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&w=500&q=80',
    price: 12999,
    mrp: 16999,
    rating: 4.3,
    ratingCount: 3421,
    inStock: true,
  },
  {
    id: 'w3',
    name: 'LIFE FIT Diary Collection Notebook A5 Unruled 150 Pages',
    image: 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=500&q=80',
    price: 298,
    mrp: 795,
    rating: 5,
    ratingCount: 3,
    inStock: true,
  },
  {
    id: 'w4',
    name: 'Titan Analog Watch for Women with Steel Strap',
    image: 'https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=500&q=80',
    price: 2495,
    mrp: 3995,
    rating: 4.5,
    ratingCount: 612,
    inStock: false,
  },
  {
    id: 'w5',
    name: 'Nike Revolution 6 Running Shoes for Men',
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=500&q=80',
    price: 2799,
    mrp: 4995,
    rating: 4.4,
    ratingCount: 894,
    inStock: true,
  },
];

const SUGGESTED_PRODUCTS = [
  { id: 'sg1', name: 'HAYATCRAFT HANDMADE Diary', image: 'https://images.unsplash.com/photo-1531346878377-a5be20888e57?auto=format&fit=crop&w=400&q=80', price: 162, mrp: 999, discountPct: 84, rating: 4.2 },
  { id: 'sg2', name: 'Portable Bluetooth Speaker', image: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&w=400&q=80', price: 899, mrp: 1999, discountPct: 55, rating: 4.1 },
  { id: 'sg3', name: 'Wireless Charging Pad', image: 'https://images.unsplash.com/photo-1622957461294-2ce6b6d33d20?auto=format&fit=crop&w=400&q=80', price: 499, mrp: 999, discountPct: 50, rating: 4.0 },
];

const WishlistCard = ({ item, onRemove, onMoveToCart, onPress }) => {
  const discountPct = item.mrp && item.mrp > item.price
    ? Math.round(((item.mrp - item.price) / item.mrp) * 100)
    : null;
  const heartScale = useSharedValue(1);

  const heartAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
  }));

  const handleRemove = () => {
    haptics.warning();
    heartScale.value = withSpring(1.3, { damping: 9, stiffness: 180 }, () => {
      heartScale.value = withSpring(1, { damping: 12, stiffness: 200 });
    });
    onRemove();
  };

  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={styles.card}>
      <View style={styles.imageBox}>
        <Image source={{ uri: item.image }} style={styles.image} resizeMode="cover" />

        {discountPct ? (
          <View style={styles.discountBadge}>
            <Text style={styles.discountBadgeText}>{discountPct}% OFF</Text>
          </View>
        ) : null}

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={handleRemove}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.heartBtn}>
          <Animated.View style={heartAnimatedStyle}>
            <Icon name="heart" size={16} color={COLORS.offerRed} style={{ marginTop: -1 }} />
          </Animated.View>
        </TouchableOpacity>

        {!item.inStock ? (
          <View style={styles.stockOverlay}>
            <Text style={styles.stockOverlayText}>OUT OF STOCK</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.name} numberOfLines={2}>{item.name}</Text>

      <RatingBadge variant="stars" rating={item.rating} count={item.ratingCount} style={styles.ratingRow} />

      <PriceBlock price={item.price} mrp={item.mrp} style={styles.priceBlock} />

      <PressableScale
        disabled={!item.inStock}
        haptic={item.inStock ? 'medium' : false}
        onPress={onMoveToCart}
        style={[styles.moveBtn, !item.inStock && styles.moveBtnDisabled]}>
        <Icon name="shopping-cart" size={13} color={item.inStock ? COLORS.white : COLORS.textTertiary} />
        <Text style={[styles.moveBtnText, !item.inStock && styles.moveBtnTextDisabled]}>
          {item.inStock ? 'Move to Cart' : 'Notify Me'}
        </Text>
      </PressableScale>
    </TouchableOpacity>
  );
};

const WishlistScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [wishlist, setWishlist] = useState(INITIAL_WISHLIST);

  const removeItem = (id) => setWishlist((prev) => prev.filter((item) => item.id !== id));

  return (
    <View style={styles.container}>
      <StatusBarManager barStyle="dark-content" themeColor={COLORS.surface} />

      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity onPress={() => navigation && navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>My Wishlist</Text>
          {wishlist.length > 0 ? (
            <Text style={styles.headerSubtitle}>
              {wishlist.length} {wishlist.length === 1 ? 'item' : 'items'} saved
            </Text>
          ) : null}
        </View>
        {wishlist.length > 0 ? (
          <TouchableOpacity style={styles.shareBtn}>
            <Icon name="share-2" size={18} color={COLORS.textPrimary} />
          </TouchableOpacity>
        ) : null}
      </View>

      {wishlist.length === 0 ? (
        <FlatList
          data={[]}
          keyExtractor={() => 'empty'}
          ListEmptyComponent={
            <View>
              <View style={styles.emptyPanel}>
                <EmptyWishlistIllustration />
                <Text style={styles.emptyTitle}>Your wishlist is empty!</Text>
                <Text style={styles.emptySubtitle}>
                  Save items you love by tapping the heart icon on any product.
                </Text>
                <PressableScale
                  haptic="medium"
                  onPress={() => navigation && navigation.navigate('MainTabs', { screen: 'Home' })}
                  style={styles.shopNowBtn}>
                  <Text style={styles.shopNowText}>Start Shopping</Text>
                </PressableScale>
              </View>

              <View style={styles.suggestedWrapper}>
                <Text style={styles.suggestedTitle}>You Might Like</Text>
                <HorizontalProductRail
                  data={SUGGESTED_PRODUCTS}
                  showRating
                  style={{ marginTop: SPACING.m }}
                  onPressItem={(product) => navigation && navigation.navigate('ProductDetail', { product })}
                />
              </View>
            </View>
          }
        />
      ) : (
        <FlatList
          data={wishlist}
          keyExtractor={(item) => item.id}
          numColumns={2}
          showsVerticalScrollIndicator={false}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={styles.gridContent}
          renderItem={({ item }) => (
            <WishlistCard
              item={item}
              onRemove={() => removeItem(item.id)}
              onMoveToCart={() => removeItem(item.id)}
              onPress={() => navigation && navigation.navigate('ProductDetail', { product: item })}
            />
          )}
          ListFooterComponent={
            <View style={styles.suggestedWrapper}>
              <Text style={styles.suggestedTitle}>You Might Also Like</Text>
              <HorizontalProductRail
                data={SUGGESTED_PRODUCTS}
                showRating
                style={{ marginTop: SPACING.m, paddingHorizontal: 0 }}
                onPressItem={(product) => navigation && navigation.navigate('ProductDetail', { product })}
              />
            </View>
          }
        />
      )}
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
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.l,
    paddingBottom: SPACING.m,
  },
  backBtn: {
    marginRight: SPACING.m,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '500',
    color: COLORS.textPrimary,
  },
  headerSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  shareBtn: {
    padding: SPACING.xs,
  },
  gridContent: {
    paddingHorizontal: SPACING.l,
    paddingTop: SPACING.l,
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
  stockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stockOverlayText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
  },
  name: {
    fontSize: 12.5,
    color: COLORS.textPrimary,
    lineHeight: 16,
    minHeight: 32,
    marginBottom: 4,
  },
  ratingRow: {
    marginBottom: 4,
  },
  priceBlock: {
    marginBottom: SPACING.s,
  },
  moveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.s,
    paddingVertical: 7,
    gap: 6,
  },
  moveBtnDisabled: {
    backgroundColor: COLORS.mutedBg,
  },
  moveBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: COLORS.white,
  },
  moveBtnTextDisabled: {
    color: COLORS.textTertiary,
  },
  emptyPanel: {
    alignItems: 'center',
    paddingTop: SPACING.xxxl,
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.xl,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: SPACING.l,
    marginBottom: SPACING.xs,
  },
  emptySubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: SPACING.xl,
  },
  shopNowBtn: {
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: RADIUS.s,
    paddingHorizontal: SPACING.xxl,
    paddingVertical: SPACING.m,
  },
  shopNowText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
  suggestedWrapper: {
    marginTop: SPACING.xl,
    paddingHorizontal: SPACING.l,
  },
  suggestedTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
});

export default WishlistScreen;
