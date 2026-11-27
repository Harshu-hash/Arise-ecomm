import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import CategoryIcon from '../../../shared/components/CategoryIcon';
import { COLORS } from '../../../constants/colors';
import { SPACING, RADIUS } from '../../../constants/spacing';

/** One row of the "All Categories" sidebar: image/icon + label. The white selection backdrop is drawn (and animated) by CategorySidebar. */
const CategorySidebarRow = ({ item, isSelected, onPress }) => (
  <TouchableOpacity
    activeOpacity={0.8}
    onPress={onPress}
    style={styles.row}
  >
    <View style={styles.imageBox}>
      {item.image ? (
        <Image source={{ uri: item.image }} style={styles.image} resizeMode="cover" />
      ) : (
        <CategoryIcon name={item.icon} size={20} color={COLORS.primary} />
      )}
    </View>
    <Text style={[styles.label, isSelected && styles.labelSelected]} numberOfLines={2}>
      {item.name}
    </Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    paddingVertical: SPACING.s + 2,
    paddingHorizontal: SPACING.xs,
  },
  imageBox: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.round,
    backgroundColor: COLORS.mutedBg,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginBottom: 4,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  label: {
    fontSize: 10.5,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 13,
    minHeight: 26,
  },
  labelSelected: {
    color: COLORS.primary,
    fontWeight: '700',
  },
});

export default CategorySidebarRow;
