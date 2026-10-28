import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../constants/spacing';

/** "Suggested For You  →" section header used on Home / Product Detail rails. */
const SectionHeaderArrow = ({ title, onPress, style }) => (
  <View style={[styles.row, style]}>
    <Text style={styles.title}>{title}</Text>
    <TouchableOpacity activeOpacity={0.8} onPress={onPress} style={styles.arrowBtn}>
      <Icon name="arrow-right" size={16} color={COLORS.white} />
    </TouchableOpacity>
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.l,
    marginBottom: SPACING.m,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  arrowBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.black,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default SectionHeaderArrow;
