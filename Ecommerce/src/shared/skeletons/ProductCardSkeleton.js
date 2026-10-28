import React from 'react';
import { View } from 'react-native';
import { useTheme } from '@theme';
import Skeleton from '@shared/skeletons/Skeleton';

const IMAGE_HEIGHT = 150;

/** Skeleton matching ProductCard's exact layout, to avoid content jumps. */
function ProductCardSkeleton({ style }) {
  const { spacing, radius, colors } = useTheme();

  return (
    <View
      style={[
        {
          borderRadius: radius.lg,
          backgroundColor: colors.card,
          padding: spacing.sm,
        },
        style,
      ]}>
      <Skeleton height={IMAGE_HEIGHT} borderRadius={radius.md} />
      <Skeleton height={12} width="55%" style={{ marginTop: spacing.sm }} />
      <Skeleton height={14} width="90%" style={{ marginTop: spacing.xs }} />
      <Skeleton height={12} width="40%" style={{ marginTop: spacing.xs }} />
      <Skeleton height={16} width="60%" style={{ marginTop: spacing.sm }} />
    </View>
  );
}

export default React.memo(ProductCardSkeleton);
