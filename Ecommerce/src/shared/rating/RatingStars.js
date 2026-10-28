import React from 'react';
import { View, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { useTheme } from '@theme';
import AppText from '@shared/ui/AppText';

const MAX_STARS = 5;

/**
 * Compact rating display: ★★★★☆ 4.2 (1.2k).
 * Uses filled/half/empty stars; count is optional.
 */
function RatingStars({ rating = 0, count, size = 12, style }) {
  const { colors, spacing } = useTheme();

  const stars = Array.from({ length: MAX_STARS }, (_, index) => {
    const position = index + 1;
    if (rating >= position - 0.25) {
      return 'star';
    }
    if (rating >= position - 0.75) {
      return 'star-half-full';
    }
    return 'star-o';
  });

  return (
    <View
      style={[styles.row, style]}
      accessibilityLabel={`Rated ${rating} out of ${MAX_STARS}`}>
      {stars.map((name, index) => (
        <Icon
          // Static list — position is the identity.
          // eslint-disable-next-line react/no-array-index-key
          key={index}
          name={name}
          size={size}
          color={colors.rating}
          style={styles.star}
        />
      ))}
      <AppText variant="bodySm" color="textSecondary" style={{ marginLeft: spacing.xxs }}>
        {rating > 0 ? rating.toFixed(1) : ''}
        {count != null ? ` (${count})` : ''}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  star: { marginRight: 1 },
});

export default React.memo(RatingStars);
