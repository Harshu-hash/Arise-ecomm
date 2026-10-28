import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../../constants/colors';
import { SPACING, RADIUS } from '../../../constants/spacing';
import { StatusBarManager } from '../../../shared/components';
import PressableScale from '../../../shared/ui/PressableScale';
import { haptics } from '../../../utils/haptics';

const QUICK_AMOUNTS = [100, 500, 1000, 2000];

const AddMoneyScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [amount, setAmount] = useState('');

  const numericAmount = Number(amount) || 0;

  const handleProceed = () => {
    if (numericAmount < 10) return;
    haptics.medium();
    navigation &&
      navigation.navigate('PaymentMethod', {
        purpose: 'WALLET_TOPUP',
        priceDetails: { grandTotal: numericAmount },
      });
  };

  return (
    <View style={styles.container}>
      <StatusBarManager barStyle="dark-content" themeColor={COLORS.surface} />

      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity onPress={() => navigation && navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Money</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.label}>Enter amount</Text>
        <View style={styles.amountInputRow}>
          <Text style={styles.rupeeSign}>₹</Text>
          <TextInput
            style={styles.amountInput}
            value={amount}
            onChangeText={(t) => setAmount(t.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={COLORS.textTertiary}
            autoFocus
          />
        </View>

        <View style={styles.chipsRow}>
          {QUICK_AMOUNTS.map((a) => (
            <TouchableOpacity key={a} style={styles.chip} onPress={() => setAmount(String(a))}>
              <Text style={styles.chipText}>₹{a}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {amount !== '' && numericAmount < 10 ? (
          <Text style={styles.errorText}>Minimum amount is ₹10</Text>
        ) : null}
      </View>

      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <PressableScale
          haptic={false}
          disabled={numericAmount < 10}
          onPress={handleProceed}
          style={[styles.proceedBtn, numericAmount < 10 && styles.proceedBtnDisabled]}>
          <Text style={styles.proceedText}>
            {numericAmount >= 10 ? `Proceed to add ₹${numericAmount}` : 'Enter an amount'}
          </Text>
        </PressableScale>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.l,
    paddingBottom: SPACING.m,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: {
    marginRight: SPACING.m,
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: '500',
    color: COLORS.textPrimary,
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING.l,
    paddingTop: SPACING.xl,
  },
  label: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: SPACING.s,
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
    paddingBottom: SPACING.s,
  },
  rupeeSign: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginRight: SPACING.s,
  },
  amountInput: {
    flex: 1,
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.textPrimary,
    padding: 0,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.s,
    marginTop: SPACING.l,
  },
  chip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.round,
    paddingHorizontal: SPACING.l,
    paddingVertical: SPACING.s,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  errorText: {
    fontSize: 12,
    color: COLORS.error,
    marginTop: SPACING.m,
  },
  bottomBar: {
    paddingHorizontal: SPACING.l,
    paddingTop: SPACING.m,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  proceedBtn: {
    backgroundColor: COLORS.ctaYellow,
    borderRadius: RADIUS.s,
    paddingVertical: SPACING.m,
    alignItems: 'center',
  },
  proceedBtnDisabled: {
    opacity: 0.5,
  },
  proceedText: {
    color: COLORS.textPrimary,
    fontWeight: '700',
    fontSize: 15,
  },
});

export default AddMoneyScreen;
