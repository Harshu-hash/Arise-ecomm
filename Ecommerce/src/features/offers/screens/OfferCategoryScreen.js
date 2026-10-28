import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../../constants/colors';
import { SPACING, RADIUS } from '../../../constants/spacing';
import { StatusBarManager, GradientBackground, MarketProductCard } from '../../../shared/components';
import { getDealCategoryProducts } from '../data/dealCategoryProducts';

const SORT_OPTIONS = [
  { id: 'popular', label: 'Popularity' },
  { id: 'priceLow', label: 'Price: Low to High' },
  { id: 'priceHigh', label: 'Price: High to Low' },
  { id: 'discount', label: 'Discount' },
];

const DECO_EMOJIS = {
  rakhiEssentials: ['🎊', '🧵'],
  rakhiGifting: ['🎁', '💝'],
  flashHourDeals: ['⚡', '🔥'],
  grocery: ['🛒', '🥬'],
};

const sortProducts = (products, sortId) => {
  const copy = [...products];
  if (sortId === 'priceLow') return copy.sort((a, b) => a.price - b.price);
  if (sortId === 'priceHigh') return copy.sort((a, b) => b.price - a.price);
  if (sortId === 'discount') {
    const pct = (p) => (p.mrp && p.mrp > p.price ? (p.mrp - p.price) / p.mrp : 0);
    return copy.sort((a, b) => pct(b) - pct(a));
  }
  return copy;
};

const OfferCategoryScreen = ({ navigation, route }) => {
  const category = (route && route.params && route.params.category) || {
    id: 'rakhiEssentials',
    title: 'Deals',
    tag: 'OFFER',
    accent: '#F5443A',
    subtitle: 'Handpicked offers for you',
  };

  const [sortId, setSortId] = useState('popular');
  const rawProducts = useMemo(() => getDealCategoryProducts(category.id), [category.id]);
  const products = useMemo(() => sortProducts(rawProducts, sortId), [rawProducts, sortId]);

  const maxDiscountPct = useMemo(
    () =>
      rawProducts.reduce((max, p) => {
        if (p.mrp && p.mrp > p.price) {
          return Math.max(max, Math.round(((p.mrp - p.price) / p.mrp) * 100));
        }
        return max;
      }, 0),
    [rawProducts]
  );

  const avgRating = useMemo(() => {
    const rated = rawProducts.filter((p) => p.rating != null);
    if (!rated.length) return null;
    return (rated.reduce((s, p) => s + p.rating, 0) / rated.length).toFixed(1);
  }, [rawProducts]);

  const heroGradient = [category.accent || '#F5443A', '#7A0C1E'];
  const decoEmojis = DECO_EMOJIS[category.id] || ['✨', '🏷️'];

  const handlePressProduct = (product) => {
    navigation && navigation.navigate('ProductDetail', { productId: product.id });
  };

  const ListHeader = (
    <View>
      <View style={styles.hero}>
        <GradientBackground colors={heroGradient} id={`deal_cat_grad_${category.id}`} />

        <View style={[styles.glowCircle, styles.glowCircleTop]} pointerEvents="none" />
        <View style={[styles.glowCircle, styles.glowCircleBottom]} pointerEvents="none" />
        <Text style={[styles.decoEmoji, styles.decoEmojiTop]} pointerEvents="none">{decoEmojis[0]}</Text>
        <Text style={[styles.decoEmoji, styles.decoEmojiBottom]} pointerEvents="none">{decoEmojis[1]}</Text>

        <SafeAreaView edges={['top']} style={styles.heroSafe}>
          <View style={styles.heroTopRow}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => navigation && navigation.goBack()}>
              <Icon name="arrow-left" size={20} color={COLORS.white} />
            </TouchableOpacity>
            <View style={styles.heroTopActions}>
              <TouchableOpacity style={styles.iconBtn}>
                <Icon name="search" size={18} color={COLORS.white} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn}>
                <Icon name="share-2" size={17} color={COLORS.white} />
              </TouchableOpacity>
            </View>
          </View>

          {category.tag ? (
            <View style={styles.tagPill}>
              <Icon name="zap" size={11} color={COLORS.ctaYellow} />
              <Text style={styles.tagText}>{category.tag}</Text>
            </View>
          ) : null}
          <Text style={styles.heroTitle}>{category.title}</Text>
          {category.subtitle ? <Text style={styles.heroSubtitle}>{category.subtitle}</Text> : null}

          <View style={styles.statRow}>
            <View style={styles.statChip}>
              <Icon name="tag" size={13} color={COLORS.white} />
              <Text style={styles.statValue}>{products.length}</Text>
              <Text style={styles.statLabel}>Offers</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statChip}>
              <Icon name="trending-down" size={13} color={COLORS.white} />
              <Text style={styles.statValue}>{maxDiscountPct}%</Text>
              <Text style={styles.statLabel}>Max Off</Text>
            </View>
            {avgRating ? (
              <>
                <View style={styles.statDivider} />
                <View style={styles.statChip}>
                  <Icon name="star" size={13} color={COLORS.ctaYellow} />
                  <Text style={styles.statValue}>{avgRating}</Text>
                  <Text style={styles.statLabel}>Rating</Text>
                </View>
              </>
            ) : null}
          </View>
        </SafeAreaView>

        <Svg style={styles.wave} viewBox="0 0 375 34" preserveAspectRatio="none" pointerEvents="none">
          <Path
            d="M0,34 L0,16 C70,34 130,2 200,12 C270,22 310,4 375,18 L375,34 Z"
            fill={COLORS.background}
          />
        </Svg>
      </View>

      <FlatList
        horizontal
        data={SORT_OPTIONS}
        keyExtractor={(o) => o.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.sortRow}
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setSortId(item.id)}
            style={[styles.sortChip, sortId === item.id && styles.sortChipActive]}>
            <Text style={[styles.sortChipText, sortId === item.id && styles.sortChipTextActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );

  return (
    <View style={styles.root}>
      <StatusBarManager barStyle="light-content" themeColor={category.accent || COLORS.offerRed} />
      <StatusBar translucent backgroundColor="transparent" />

      <FlatList
        data={products}
        keyExtractor={(p) => p.id}
        numColumns={2}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={ListHeader}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.gridContent}
        renderItem={({ item }) => (
          <MarketProductCard
            product={item}
            showRating
            onPress={() => handlePressProduct(item)}
            style={styles.gridCard}
          />
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },

  hero: { position: 'relative', overflow: 'hidden', paddingBottom: SPACING.xl },
  heroSafe: { paddingHorizontal: SPACING.l, paddingTop: SPACING.s },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroTopActions: { flexDirection: 'row', gap: SPACING.s },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  glowCircle: { position: 'absolute', borderRadius: RADIUS.round, backgroundColor: 'rgba(255,255,255,0.14)' },
  glowCircleTop: { width: 170, height: 170, top: -70, right: -50 },
  glowCircleBottom: { width: 220, height: 220, bottom: -110, left: -70 },
  decoEmoji: { position: 'absolute', fontSize: 22, opacity: 0.4 },
  decoEmojiTop: { top: 64, right: 32, transform: [{ rotate: '14deg' }] },
  decoEmojiBottom: { bottom: 74, left: 22, fontSize: 18, transform: [{ rotate: '-12deg' }] },

  tagPill: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.28)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.round,
    marginTop: SPACING.l,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  tagText: { color: COLORS.ctaYellow, fontSize: 10.5, fontWeight: '800', letterSpacing: 0.6 },
  heroTitle: {
    color: COLORS.white,
    fontSize: 30,
    fontWeight: '900',
    marginTop: SPACING.s,
    letterSpacing: 0.2,
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  heroSubtitle: { color: 'rgba(255,255,255,0.88)', fontSize: 13.5, marginTop: 4 },

  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    borderRadius: RADIUS.l,
    marginTop: SPACING.l,
    paddingVertical: SPACING.s,
    paddingHorizontal: SPACING.m,
  },
  statChip: { alignItems: 'center', gap: 2, paddingHorizontal: SPACING.s },
  statValue: { color: COLORS.white, fontSize: 14, fontWeight: '800' },
  statLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 9.5, fontWeight: '600', letterSpacing: 0.3 },
  statDivider: { width: 1, height: 26, backgroundColor: 'rgba(255,255,255,0.25)' },

  wave: { position: 'absolute', left: 0, right: 0, bottom: -1, height: 26, width: '100%' },

  sortRow: { paddingHorizontal: SPACING.l, paddingVertical: SPACING.m, gap: SPACING.s },
  sortChip: { paddingHorizontal: SPACING.m, paddingVertical: 8, borderRadius: RADIUS.round, backgroundColor: COLORS.mutedBg, borderWidth: 1, borderColor: COLORS.cardBorder },
  sortChipActive: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  sortChipText: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
  sortChipTextActive: { color: COLORS.primary, fontWeight: '700' },

  gridContent: { paddingHorizontal: SPACING.l, paddingBottom: SPACING.xxl },
  row: { justifyContent: 'space-between' },
  gridCard: { width: '48%', marginRight: 0, marginBottom: SPACING.l },
});

export default OfferCategoryScreen;
