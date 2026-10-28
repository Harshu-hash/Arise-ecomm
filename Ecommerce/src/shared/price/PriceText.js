import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '@theme';
import AppText from '@shared/ui/AppText';

const PERCENT = 100;

/** Format a number as Indian-locale currency, e.g. 1,29,999. */
export function formatPrice(amount, currency = '₹') {
  return `${currency}${Number(amount).toLocaleString('en-IN')}`;
}

/**
 * Price row: selling price + optional strikethrough MRP + discount %.
 * The single source of price presentation across the app.
 * size: 'md' (cards) | 'lg' (product details)
 */
function PriceText({ price, mrp, currency = '₹', size = 'md', style }) {
  const { spacing } = useTheme();
  const hasDiscount = mrp != null && mrp > price;
  const discountPercent = hasDiscount ? Math.round(((mrp - price) / mrp) * PERCENT) : 0;

  return (
    <View style={[styles.row, style]}>
      <AppText variant={size === 'lg' ? 'priceLg' : 'price'}>
        {formatPrice(price, currency)}
      </AppText>
      {hasDiscount ? (
        <>
          <AppText
            variant="bodySm"
            color="strikethrough"
            style={[styles.mrp, { marginLeft: spacing.xs }]}>
            {formatPrice(mrp, currency)}
          </AppText>
          <AppText variant="offer" color="priceDiscount" style={{ marginLeft: spacing.xs }}>
            {discountPercent}% off
          </AppText>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'baseline' },
  mrp: { textDecorationLine: 'line-through' },
});

export default React.memo(PriceText);
