import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../../constants/colors';
import { SPACING, RADIUS } from '../../../constants/spacing';

/** Shown in a BottomSheetModal when a transaction row is tapped on the Wallet screen. */
const TransactionDetailSheet = ({ transaction }) => {
  if (!transaction) return null;
  const isCredit = transaction.type === 'credit';

  return (
    <View style={styles.content}>
      <View style={styles.handle} />
      <View style={[styles.iconWrap, { backgroundColor: isCredit ? '#EAF7EC' : '#FBE7EC' }]}>
        <Icon
          name={isCredit ? 'arrow-down-left' : 'arrow-up-right'}
          size={22}
          color={isCredit ? COLORS.success : COLORS.offerRed}
        />
      </View>
      <Text style={styles.amount}>
        {isCredit ? '+' : '-'}₹{transaction.amount}
      </Text>
      <Text style={styles.title}>{transaction.title}</Text>

      <View style={styles.divider} />

      <View style={styles.row}>
        <Text style={styles.rowLabel}>Reference</Text>
        <Text style={styles.rowValue}>{transaction.subtitle}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>Date</Text>
        <Text style={styles.rowValue}>{transaction.date}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>Transaction ID</Text>
        <Text style={[styles.rowValue, styles.mono]}>{transaction.id}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>Status</Text>
        <Text style={[styles.rowValue, { color: COLORS.success }]}>Completed</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  content: {
    padding: SPACING.l,
    paddingBottom: SPACING.xxxl,
    alignItems: 'center',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    marginBottom: SPACING.l,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.round,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.m,
  },
  amount: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  title: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  divider: {
    alignSelf: 'stretch',
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBorder,
    marginVertical: SPACING.l,
  },
  row: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.m,
  },
  rowLabel: {
    fontSize: 12.5,
    color: COLORS.textSecondary,
  },
  rowValue: {
    fontSize: 12.5,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  mono: {
    fontFamily: 'monospace',
  },
});

export default TransactionDetailSheet;
