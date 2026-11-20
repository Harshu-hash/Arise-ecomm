import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../constants/colors';
import { RADIUS } from '../../constants/spacing';

const PERCENT = 100;

/** Green "NN% OFF" tag from price vs MRP; renders nothing when there is no discount. Position it via `style`. */
const DiscountBadge = ({ price, mrp, style }) => {
  const pct = mrp > price ? Math.round(((mrp - price) / mrp) * PERCENT) : 0;
  if (pct < 1) return null;
  return (
    <View style={[styles.badge, style]}>
      <Text style={styles.text}>{pct}% OFF</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    backgroundColor: COLORS.ratingGreen,
    borderRadius: RADIUS.xs,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  text: { color: COLORS.white, fontSize: 9.5, fontWeight: '800' },
});

export default DiscountBadge;
