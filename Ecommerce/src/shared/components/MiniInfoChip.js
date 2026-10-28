import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../constants/colors';
import { SPACING, RADIUS } from '../../constants/spacing';

/** Small outlined info chip, e.g. "Cancellation upto 24hrs". Render two side by side in a row. */
const MiniInfoChip = ({ icon, label, style }) => (
  <View style={[styles.chip, style]}>
    <View style={styles.iconCircle}>
      <Icon name={icon} size={13} color={COLORS.primary} />
    </View>
    <Text style={styles.label} numberOfLines={2}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  chip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.round,
    paddingVertical: SPACING.s,
    paddingHorizontal: SPACING.s + 2,
  },
  iconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.xs,
  },
  label: {
    flex: 1,
    fontSize: 11.5,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
});

export default MiniInfoChip;
