import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../constants/colors';
import { SPACING, RADIUS } from '../../constants/spacing';

/** "Sold By X · 4.5★ · N years with Flipkart | See other sellers" row for Product Detail. */
const SellerInfoRow = ({ sellerName, rating, yearsWithFlipkart, onSeeOtherSellers }) => (
  <View style={styles.row}>
    <View style={styles.iconBox}>
      <Icon name="shopping-bag" size={15} color={COLORS.textPrimary} />
    </View>
    <View style={styles.textBox}>
      <Text style={styles.sellerName}>{`Sold By ${sellerName}`}</Text>
      <View style={styles.metaRow}>
        <Text style={styles.metaText}>{`${rating}★`}</Text>
        <Text style={styles.metaDot}>{'•'}</Text>
        <Text style={styles.metaText}>{`${yearsWithFlipkart} years with Flipkart`}</Text>
        <Text style={styles.metaDot}>{'|'}</Text>
        <TouchableOpacity onPress={onSeeOtherSellers}>
          <Text style={styles.link}>See other sellers</Text>
        </TouchableOpacity>
      </View>
    </View>
    <Icon name="chevron-right" size={18} color={COLORS.textTertiary} />
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: SPACING.m,
    paddingHorizontal: SPACING.m,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  iconBox: {
    width: 30,
    height: 30,
    borderRadius: RADIUS.s,
    backgroundColor: COLORS.mutedBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.s,
  },
  textBox: {
    flex: 1,
  },
  sellerName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  metaText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  metaDot: {
    fontSize: 12,
    color: COLORS.textTertiary,
    marginHorizontal: 5,
  },
  link: {
    fontSize: 12,
    color: COLORS.textPrimary,
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
});

export default SellerInfoRow;
