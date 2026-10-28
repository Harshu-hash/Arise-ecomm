import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../constants/spacing';

/**
 * Flipkart-style price composition: ↓62%  ₹795  ₹298
 * (green discount %, strike-through MRP, bold final price)
 */
const PriceBlock = ({ price, mrp, discountPct, size = 'md', style }) => {
  const computedPct =
    discountPct != null
      ? discountPct
      : mrp && mrp > price
      ? Math.round(((mrp - price) / mrp) * 100)
      : null;

  const isLg = size === 'lg';

  return (
    <View style={[styles.row, style]}>
      {computedPct ? (
        <Text style={[styles.discount, isLg && styles.discountLg]}>{'↓'}{computedPct}%</Text>
      ) : null}
      {mrp && mrp > price ? (
        <Text style={[styles.mrp, isLg && styles.mrpLg]}>{`₹${mrp}`}</Text>
      ) : null}
      <Text style={[styles.price, isLg && styles.priceLg]}>{`₹${price}`}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
  },
  discount: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.ratingGreen,
    marginRight: SPACING.s,
  },
  discountLg: {
    fontSize: 18,
  },
  mrp: {
    fontSize: 13,
    color: COLORS.strikethrough,
    textDecorationLine: 'line-through',
    marginRight: SPACING.s,
  },
  mrpLg: {
    fontSize: 16,
  },
  price: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  priceLg: {
    fontSize: 20,
  },
});

export default PriceBlock;
