import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { COLORS } from '../../constants/colors';
import StarRating from './StarRating';

/**
 * Three Flipkart rating treatments:
 *  - variant="pill": dark overlay pill on a product thumbnail, e.g. "4.2 ★"
 *  - variant="pillLight": white overlay pill on a hero/gallery image, e.g. "5 ★ | 3"
 *  - variant="stars": inline gold star row filled to the average, e.g. "★★★★☆ 4.0 · (3)"
 */
const RatingBadge = ({ variant = 'pill', rating, count, style }) => {
  if (rating == null) return null;

  if (variant === 'stars') {
    return (
      <View style={[styles.starsRow, style]}>
        <StarRating rating={rating} size={12} style={styles.starsIconsRow} />
        <Text style={styles.starsRating}>{rating}</Text>
        {count != null ? <Text style={styles.starsCount}>{`· (${count})`}</Text> : null}
      </View>
    );
  }

  if (variant === 'pillLight') {
    return (
      <View style={[styles.pillLight, style]}>
        <Text style={styles.pillLightText}>{rating}</Text>
        <Icon name="star" size={11} color={COLORS.starGold} style={{ marginHorizontal: 4 }} />
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
      <Icon name="star" size={9} color={COLORS.starGold} style={{ marginLeft: 2 }} />
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
  starsRating: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginRight: 4,
  },
  starsCount: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
});

export default RatingBadge;
