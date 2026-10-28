import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../../constants/colors';
import { SPACING, RADIUS } from '../../../constants/spacing';

/** Left sidebar row on "All Categories" — circular image/icon + label, blue accent when selected. */
const CategorySidebarRow = ({ item, isSelected, onPress }) => (
  <TouchableOpacity activeOpacity={0.8} onPress={onPress} style={[styles.row, isSelected && styles.rowSelected]}>
    <View style={styles.imageBox}>
      {item.image ? (
        <Image source={{ uri: item.image }} style={styles.image} resizeMode="cover" />
      ) : (
        <Icon name={item.icon || 'grid'} size={20} color={COLORS.primary} />
      )}
    </View>
    <Text style={[styles.label, isSelected && styles.labelSelected]} numberOfLines={2}>{item.name}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    paddingVertical: SPACING.s + 2,
    paddingHorizontal: SPACING.xs,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
  },
  rowSelected: {
    backgroundColor: COLORS.primaryLight,
    borderLeftColor: COLORS.primary,
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
