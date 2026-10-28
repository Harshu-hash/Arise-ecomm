import React from 'react';
import { FlatList } from 'react-native';
import { SPACING } from '../../constants/spacing';
import MarketProductCard from './MarketProductCard';

/** Thin FlatList wrapper for horizontal MarketProductCard rails (Home, Product Detail). */
const HorizontalProductRail = ({ data, onPressItem, showRating, showDelivery, style }) => (
  <FlatList
    horizontal
    data={data}
    keyExtractor={(item) => item.id}
    showsHorizontalScrollIndicator={false}
    contentContainerStyle={[{ paddingHorizontal: SPACING.l }, style]}
    renderItem={({ item }) => (
      <MarketProductCard
        product={item}
        showRating={showRating}
        showDelivery={showDelivery}
        onPress={() => onPressItem && onPressItem(item)}
      />
    )}
  />
);

export default HorizontalProductRail;
