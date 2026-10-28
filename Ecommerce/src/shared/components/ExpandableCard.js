import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../constants/colors';
import { SPACING, RADIUS } from '../../constants/spacing';

/** Flipkart-style collapsible section: title row + chevron toggle + body. */
const ExpandableCard = ({ title, defaultOpen = false, children, style }) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <View style={[styles.card, style]}>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => setOpen((prev) => !prev)}
        style={styles.headerRow}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.chevronBox}>
          <Icon name={open ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.textPrimary} />
        </View>
      </TouchableOpacity>
      {open ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    paddingVertical: SPACING.m,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  chevronBox: {
    width: 28,
    height: 28,
    borderRadius: RADIUS.s,
    backgroundColor: COLORS.mutedBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  body: {
    marginTop: SPACING.m,
  },
});

export default ExpandableCard;
