import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS } from '../../constants/colors';
import { SPACING, RADIUS } from '../../constants/spacing';

/** "Flipkart (1) / Minutes" pill row used on Cart. tabs: [{ id, label, count }] */
const SegmentedPillTabs = ({ tabs, activeId, onSelect }) => (
  <View style={styles.row}>
    {tabs.map((tab) => {
      const isActive = tab.id === activeId;
      const label = tab.count ? `${tab.label} (${tab.count})` : tab.label;
      return (
        <TouchableOpacity
          key={tab.id}
          activeOpacity={0.85}
          onPress={() => onSelect && onSelect(tab)}
          style={[styles.pill, isActive && styles.pillActive]}>
          <Text style={[styles.label, isActive && styles.labelActive]}>{label}</Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.l,
    gap: SPACING.s,
  },
  pill: {
    paddingHorizontal: SPACING.l,
    paddingVertical: SPACING.s,
    borderRadius: RADIUS.s,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  pillActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  labelActive: {
    color: COLORS.white,
  },
});

export default SegmentedPillTabs;
