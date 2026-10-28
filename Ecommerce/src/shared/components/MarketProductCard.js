import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { COLORS } from '../../constants/colors';
import { SPACING, RADIUS } from '../../constants/spacing';
import PriceBlock from './PriceBlock';
import RatingBadge from './RatingBadge';

/**
 * Flipkart marketplace product card — plain image, optional dark rating pill overlay,
 * 2-line title, price block, optional delivery-by line. Used on Home rails and
 * Product Detail "Similar Products".
 */
const MarketProductCard = ({ product, onPress, showRating = false, showDelivery = false, style }) => {
  const { name, image, price, mrp, discountPct, rating, deliveryDate } = product || {};

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={[styles.card, style]}>
      <View style={styles.imageBox}>
        {image ? (
          <Image source={typeof image === 'string' ? { uri: image } : image} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={styles.placeholder} />
        )}
        {showRating && rating != null ? (
          <RatingBadge variant="pill" rating={rating} style={styles.ratingOverlay} />
        ) : null}
      </View>

      <Text style={styles.title} numberOfLines={1}>{name}</Text>
      <PriceBlock price={price} mrp={mrp} discountPct={discountPct} style={styles.priceBlock} />
      {showDelivery && deliveryDate ? (
        <Text style={styles.delivery}>{`Get it by ${deliveryDate}`}</Text>
      ) : null}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    width: 140,
    marginRight: SPACING.m,
  },
  imageBox: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: COLORS.mutedBg,
    borderRadius: RADIUS.xs,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: SPACING.xs,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    flex: 1,
    backgroundColor: COLORS.mutedBg,
  },
  ratingOverlay: {
    position: 'absolute',
    left: 6,
    bottom: 6,
  },
  title: {
    fontSize: 12.5,
    color: COLORS.textPrimary,
    lineHeight: 16,
    marginBottom: 2,
  },
  priceBlock: {
    marginTop: 2,
  },
  delivery: {
    fontSize: 10.5,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
});

export default MarketProductCard;
