import React from 'react';
import { View, StyleSheet } from 'react-native';
import { COLORS } from '../../../constants/colors';
import { SPACING } from '../../../constants/spacing';
import { SectionHeaderArrow, HorizontalProductRail } from '../../../shared/components';

const SuggestedForYouSection = ({ products, onPressProduct, onSeeAll }) => (
  <View style={styles.wrapper}>
    <SectionHeaderArrow title="Suggested For You" onPress={onSeeAll} />
    <HorizontalProductRail data={products} onPressItem={onPressProduct} />
  </View>
);

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: COLORS.white,
    paddingVertical: SPACING.l,
    marginTop: SPACING.s,
  },
});

export default SuggestedForYouSection;
