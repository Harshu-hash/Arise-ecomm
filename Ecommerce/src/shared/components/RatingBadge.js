import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../constants/colors';

/**
 * Three Flipkart rating treatments:
 *  - variant="pill": dark overlay pill on a product thumbnail, e.g. "4.2 ★"
 *  - variant="pillLight": white overlay pill on a hero/gallery image, e.g. "5 ★ | 3"
 *  - variant="stars": inline green star row, e.g. "★ 5.0 · (3)"
 */
const RatingBadge = ({ variant = 'pill', rating, count, style }) => {
  if (rating == null) return null;

  if (variant === 'stars') {
    const filled = Math.round(rating);
    return (
      <View style={[styles.starsRow, style]}>
        <View style={styles.starsIconsRow}>
          {[1, 2, 3, 4, 5].map((i) => (
            <Icon
              key={i}
              name="star"
              size={12}
              color={i <= filled ? COLORS.ratingGreen : COLORS.border}
              style={styles.starIcon}
            />
          ))}
        </View>
        <Text style={styles.starsRating}>{rating}</Text>
        {count != null ? <Text style={styles.starsCount}>{`· (${count})`}</Text> : null}
      </View>
    );
  }

  if (variant === 'pillLight') {
    return (
      <View style={[styles.pillLight, style]}>
        <Text style={styles.pillLightText}>{rating}</Text>
        <Icon name="star" size={11} color={COLORS.ratingGreen} style={{ marginHorizontal: 4 }} />
        {count != null ? (
          <>
            <View style={styles.pillLightDivider} />
            <Text style={styles.pillLightCount}>{count}</Text>
          </>
        ) : null}
      </View>
    );
  }

  return (
    <View style={[styles.pill, style]}>
      <Text style={styles.pillText}>{rating}</Text>
      <Icon name="star" size={9} color={COLORS.white} style={{ marginLeft: 2 }} />
    </View>
  );
};

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.badgeDark,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    alignSelf: 'flex-start',
  },
  pillText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: '700',
  },
  pillLight: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  pillLightText: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  pillLightDivider: {
    width: 1,
    height: 12,
    backgroundColor: COLORS.border,
    marginRight: 6,
  },
  pillLightCount: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starsIconsRow: {
    flexDirection: 'row',
    marginRight: 6,
  },
  starIcon: {
    marginRight: 1,
  },
  starsRating: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.ratingGreen,
    marginRight: 4,
  },
  starsCount: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
});

export default RatingBadge;
