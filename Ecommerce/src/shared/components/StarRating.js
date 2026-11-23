import React from 'react';
import { View, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { COLORS } from '../../constants/colors';

const STARS = [1, 2, 3, 4, 5];

/**
 * Five stars filled gold up to `rating` (0-5), so 4.3 shows four full stars and a third of the fifth.
 * Each star is a grey one with a gold one on top, clipped to the filled fraction.
 */
const StarRating = ({ rating, size = 12, gap = 1, style }) => {
  const value = rating == null || rating === '' ? NaN : Number(rating); // a missing rating is not a zero rating
  if (!Number.isFinite(value)) return null;
  return (
    <View
      accessible
      accessibilityLabel={`Rated ${value} out of 5`}
      style={[styles.row, style]}
    >
      {STARS.map(star => {
        const filled = Math.min(1, Math.max(0, value - (star - 1)));
        return (
          <View key={star} style={{ width: size, height: size, marginRight: star < 5 ? gap : 0 }}>
            <Icon name="star" size={size} color={COLORS.border} />
            {filled > 0 ? (
              <View style={[styles.clip, { width: size * filled }]}>
                <Icon name="star" size={size} color={COLORS.starGold} />
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  clip: { position: 'absolute', left: 0, top: 0, bottom: 0, overflow: 'hidden' },
});

export default StarRating;
