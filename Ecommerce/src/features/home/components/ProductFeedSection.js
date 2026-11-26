import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS } from '../../../constants/colors';
import { SPACING, RADIUS } from '../../../constants/spacing';
import { DiscountBadge, PriceBlock, StarRating } from '../../../shared/components';

const BADGE_STYLES = {
  'Lowest price': { bg: '#5B3DF5', text: COLORS.white },
  'New Arrival': { bg: '#E7E9ED', text: COLORS.textPrimary },
};

const ProductFeedCard = ({ product, onPress }) => {
  const { image, aspectRatio, badge, brand, title, price, mrp, rating, ratingCount } = product;
  const badgeStyle = badge ? BADGE_STYLES[badge] : null;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => onPress && onPress(product)}
      style={styles.card}
    >
      <View style={[styles.imageBox, { aspectRatio: aspectRatio || 1 }]}>
        <Image source={{ uri: image }} style={styles.image} resizeMode="cover" />
        <DiscountBadge price={price} mrp={mrp} style={styles.discountBadge} />
        {badgeStyle ? (
          <View style={[styles.badge, { backgroundColor: badgeStyle.bg }]}>
            <Text style={[styles.badgeText, { color: badgeStyle.text }]}>{badge}</Text>
          </View>
        ) : null}
      </View>

      {rating != null ? (
        <View style={styles.ratingRow}>
          <Text style={styles.ratingValue}>{rating}</Text>
          <StarRating rating={rating} size={11} style={styles.ratingIcon} />
          <Text style={styles.ratingCount}>{`(${ratingCount})`}</Text>
        </View>
      ) : null}

      <Text style={styles.title} numberOfLines={1}>
        <Text style={styles.brand}>{brand}</Text>
        {` ${title}`}
      </Text>

      <PriceBlock price={price} mrp={mrp} discountPct={0} style={styles.priceBlock} />
    </TouchableOpacity>
  );
};

/**
 * 2-column staggered ("masonry") product feed below Top Value Deals — each column is a
 * plain stacked View (odd/even split of the data) rather than a grid library, so cards
 * keep their own natural image heights and stagger against the other column, matching
 * the reference design without needing item-measurement machinery.
 */
const ProductFeedSection = ({ products, onPressProduct, title = 'You May Also Like' }) => {
  const leftColumn = products.filter((_, index) => index % 2 === 0);
  const rightColumn = products.filter((_, index) => index % 2 === 1);

  return (
    <View style={styles.wrapper}>
      {title ? <Text style={styles.sectionTitle}>{title}</Text> : null}
      <View style={styles.grid}>
        <View style={styles.column}>
          {leftColumn.map(product => (
            <ProductFeedCard key={product.id} product={product} onPress={onPressProduct} />
          ))}
        </View>
        <View style={styles.column}>
          {rightColumn.map(product => (
            <ProductFeedCard key={product.id} product={product} onPress={onPressProduct} />
          ))}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: COLORS.white,
    paddingTop: SPACING.l,
    marginTop: SPACING.s,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.textPrimary,
    paddingHorizontal: SPACING.l,
    marginBottom: SPACING.m,
  },
  grid: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.s,
  },
  column: {
    flex: 1,
    paddingHorizontal: SPACING.xs,
  },
  card: {
    marginBottom: SPACING.l,
  },
  imageBox: {
    width: '100%',
    borderRadius: RADIUS.s,
    overflow: 'hidden',
    backgroundColor: COLORS.mutedBg,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  badge: {
    position: 'absolute',
    top: SPACING.s,
    left: SPACING.s,
    paddingHorizontal: SPACING.s,
    paddingVertical: 4,
    borderRadius: RADIUS.xs,
  },
  discountBadge: { left: SPACING.s, bottom: SPACING.s },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.s,
  },
  ratingValue: {
    fontSize: 12.5,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginRight: 3,
  },
  ratingIcon: {
    marginRight: 4,
  },
  ratingCount: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  title: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  brand: {
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  priceBlock: {
    marginTop: SPACING.xs,
  },
});

export default ProductFeedSection;
