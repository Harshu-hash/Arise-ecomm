import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../../constants/colors';
import { SPACING, RADIUS } from '../../../constants/spacing';

const WalletTransactionList = ({ transactions, onSeeAll, onPressTransaction }) => (
  <>
    <View style={styles.headerRow}>
      <Text style={styles.sectionTitle}>Recent Activity</Text>
      <TouchableOpacity onPress={onSeeAll}>
        <Text style={styles.seeAllText}>See all</Text>
      </TouchableOpacity>
    </View>

    <View style={styles.txnList}>
      {transactions.map((txn) => (
        <TouchableOpacity
          key={txn.id}
          activeOpacity={0.7}
          disabled={!onPressTransaction}
          onPress={() => onPressTransaction && onPressTransaction(txn)}
          style={styles.txnRow}>
          <View
            style={[
              styles.txnIconWrap,
              { backgroundColor: txn.type === 'credit' ? '#EAF7EC' : '#FBE7EC' },
            ]}>
            <Icon
              name={txn.type === 'credit' ? 'arrow-down-left' : 'arrow-up-right'}
              size={16}
              color={txn.type === 'credit' ? COLORS.success : COLORS.offerRed}
            />
          </View>
          <View style={styles.txnBody}>
            <Text style={styles.txnTitle}>{txn.title}</Text>
            <Text style={styles.txnSubtitle}>{txn.subtitle}</Text>
            <Text style={styles.txnDate}>{txn.date}</Text>
          </View>
          <Text
            style={[
              styles.txnAmount,
              { color: txn.type === 'credit' ? COLORS.success : COLORS.textPrimary },
            ]}>
            {txn.type === 'credit' ? '+' : '-'}₹{txn.amount}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  </>
);

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: SPACING.l,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    paddingHorizontal: SPACING.l,
    marginTop: SPACING.xl,
    marginBottom: SPACING.s,
  },
  seeAllText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: COLORS.primary,
  },
  txnList: {
    paddingHorizontal: SPACING.l,
    marginTop: SPACING.xs,
  },
  txnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.m,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
  },
  txnIconWrap: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.round,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.m,
  },
  txnBody: {
    flex: 1,
  },
  txnTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  txnSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  txnDate: {
    fontSize: 11,
    color: COLORS.textTertiary,
    marginTop: 2,
  },
  txnAmount: {
    fontSize: 14,
    fontWeight: '800',
  },
});

export default WalletTransactionList;
