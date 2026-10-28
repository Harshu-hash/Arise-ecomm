import React from 'react';
import { View, StyleSheet } from 'react-native';
import FastImage from 'react-native-fast-image';
import Icon from 'react-native-vector-icons/Feather';
import { useTheme } from '@theme';
import AppText from '@shared/ui/AppText';
import PressableScale from '@shared/ui/PressableScale';
import Badge from '@shared/badges/Badge';
import RatingStars from '@shared/rating/RatingStars';
import PriceText from '@shared/price/PriceText';

const IMAGE_HEIGHT = 150;
const WISHLIST_SIZE = 32;
const PERCENT = 100;

/**
 * Grid product card. Hierarchy (top → bottom):
 * image → brand → name → rating → price → delivery hint.
 * Wishlist heart overlays the image; discount badge sits top-left.
 *
 * product: { id, name, brand, image, price, mrp, rating, ratingCount,
 *            deliveryEta, inStock, sponsored }
 */
function ProductCard({ product, onPress, onWishlistPress, wishlisted = false, style }) {
  const { colors, radius, spacing, elevation } = useTheme();
  const {
    name,
    brand,
    image,
    price,
    mrp,
    rating,
    ratingCount,
    deliveryEta,
    inStock = true,
    sponsored = false,
  } = product;

  const discountPercent =
    mrp != null && mrp > price ? Math.round(((mrp - price) / mrp) * PERCENT) : 0;

  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={name}
      style={[
        styles.card,
        elevation.level1,
        { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.sm },
        style,
      ]}>
      <View>
        <FastImage
          source={{ uri: image, priority: FastImage.priority.normal }}
          style={[
            styles.image,
            { borderRadius: radius.md, backgroundColor: colors.surfaceVariant },
          ]}
          resizeMode={FastImage.resizeMode.cover}
        />

        {discountPercent > 0 ? (
          <Badge
            label={`${discountPercent}% OFF`}
            variant="discount"
            style={[styles.discountBadge, { top: spacing.xs, left: spacing.xs }]}
          />
        ) : null}

        {onWishlistPress ? (
          <PressableScale
            onPress={onWishlistPress}
            accessibilityRole="button"
            accessibilityLabel={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
            hitSlop={spacing.xs}
            style={[
              styles.wishlist,
              elevation.level1,
              {
                top: spacing.xs,
                right: spacing.xs,
                borderRadius: radius.pill,
                backgroundColor: colors.card,
              },
            ]}>
            <Icon
              name="heart"
              size={16}
              color={wishlisted ? colors.error : colors.textTertiary}
            />
          </PressableScale>
        ) : null}
      </View>

      <View style={{ marginTop: spacing.sm }}>
        {sponsored ? (
          <AppText variant="caption" color="textTertiary">
            Sponsored
          </AppText>
        ) : null}
        {brand ? (
          <AppText variant="caption" color="textSecondary" numberOfLines={1}>
            {brand}
          </AppText>
        ) : null}
        <AppText variant="bodyMd" numberOfLines={2} style={{ marginTop: 2 }}>
          {name}
        </AppText>

        {rating != null ? (
          <RatingStars rating={rating} count={ratingCount} style={{ marginTop: spacing.xxs }} />
        ) : null}

        <PriceText price={price} mrp={mrp} style={{ marginTop: spacing.xs }} />

        {!inStock ? (
          <AppText variant="offer" color="error" style={{ marginTop: spacing.xxs }}>
            Out of stock
          </AppText>
        ) : deliveryEta ? (
          <AppText variant="bodySm" color="textSecondary" style={{ marginTop: spacing.xxs }}>
            {deliveryEta}
          </AppText>
        ) : null}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1 },
  image: { width: '100%', height: IMAGE_HEIGHT },
  discountBadge: { position: 'absolute' },
  wishlist: {
    position: 'absolute',
    width: WISHLIST_SIZE,
    height: WISHLIST_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default React.memo(ProductCard);
