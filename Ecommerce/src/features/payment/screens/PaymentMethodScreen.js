import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../../constants/colors';
import { SPACING, RADIUS } from '../../../constants/spacing';
import { StatusBarManager } from '../../../shared/components';
import { PAYMENT_METHODS } from '../../orders/constants/ordersData';
import PressableScale from '../../../shared/ui/PressableScale';
import { haptics } from '../../../utils/haptics';
import { useWallet } from '../../../contexts/WalletContext';

const PaymentMethodScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const wallet = useWallet();
  const { items = [], address, priceDetails, purpose } = route?.params || {};
  const isWalletTopUp = purpose === 'WALLET_TOPUP';
  const methods = isWalletTopUp ? PAYMENT_METHODS.filter((m) => !['wallet', 'cod'].includes(m.id)) : PAYMENT_METHODS;
  const [selected, setSelected] = useState(methods[0]?.id ?? 'upi');
  const [placing, setPlacing] = useState(false);

  const grandTotal = priceDetails?.grandTotal ?? 0;
  const method = methods.find((m) => m.id === selected);

  const handlePlaceOrder = () => {
    haptics.medium();
    setPlacing(true);
    setTimeout(() => {
      haptics.success();

      if (isWalletTopUp) {
        wallet?.addMoney(grandTotal, method?.title || 'UPI');
        setPlacing(false);
        navigation && navigation.navigate('Wallet');
        return;
      }

      if (selected === 'wallet') {
        wallet?.debit(grandTotal, 'Paid for Order', 'via Wallet');
      }

      const placedDate = new Date();
      const order = {
        id: `ORD-${Math.floor(10000 + Math.random() * 89999)}`,
        placedOn: placedDate.toLocaleString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        }),
        date: placedDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
        status: 'Confirmed',
        currentStep: 1,
        canCancel: true,
        canReturn: false,
        paymentMethod: method?.title || 'UPI',
        deliveryCode: String(Math.floor(1000 + Math.random() * 9000)),
        address,
        items,
        priceDetails,
        name: items[0]?.name,
        image: items[0]?.image,
        price: priceDetails?.grandTotal,
      };
      setPlacing(false);
      navigation &&
        navigation.reset({
          index: 1,
          routes: [{ name: 'MainTabs' }, { name: 'OrderPlaced', params: { order } }],
        });
    }, 1400);
  };

  if (placing) {
    return (
      <View style={styles.loaderContainer}>
        <StatusBarManager barStyle="dark-content" themeColor={COLORS.surface} />
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loaderText}>Placing your order…</Text>
        <Text style={styles.loaderSubtext}>Please don't press back or close the app</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBarManager barStyle="dark-content" themeColor={COLORS.surface} />

      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity onPress={() => navigation && navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payment Method</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.amountCard}>
          <Text style={styles.amountLabel}>{isWalletTopUp ? 'Amount to Add' : 'Amount Payable'}</Text>
          <Text style={styles.amountValue}>₹{grandTotal}</Text>
        </View>

        <Text style={styles.sectionTitle}>Select a payment method</Text>

        {methods.map((m) => (
          <TouchableOpacity
            key={m.id}
            activeOpacity={0.8}
            style={[styles.methodCard, selected === m.id && styles.methodCardActive]}
            onPress={() => {
              haptics.selection();
              setSelected(m.id);
            }}>
            <View style={styles.methodIconCircle}>
              <Icon name={m.icon} size={18} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.methodTitle}>{m.title}</Text>
              <Text style={styles.methodSubtitle}>{m.id === 'wallet' ? `Balance: ₹${wallet?.balance ?? 0}` : m.subtitle}</Text>
            </View>
            <View style={[styles.radio, selected === m.id && styles.radioActive]}>
              {selected === m.id ? <View style={styles.radioDot} /> : null}
            </View>
          </TouchableOpacity>
        ))}

        <View style={styles.secureNote}>
          <Icon name="lock" size={14} color={COLORS.textTertiary} />
          <Text style={styles.secureNoteText}>
            100% safe & secure payments. Your information is encrypted end-to-end.
          </Text>
        </View>
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <PressableScale haptic={false} onPress={handlePlaceOrder} style={styles.placeOrderBtn}>
          <Text style={styles.placeOrderText}>
            {selected === 'cod' ? 'Place Order' : `Pay ₹${grandTotal}`}
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
  loaderContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xxl,
  },
  loaderText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: SPACING.l,
  },
  loaderSubtext: {
    fontSize: 12.5,
    color: COLORS.textSecondary,
    marginTop: SPACING.s,
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
  scrollContent: {
    paddingHorizontal: SPACING.l,
    paddingTop: SPACING.l,
    paddingBottom: SPACING.xxxl,
  },
  amountCard: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.m,
    padding: SPACING.l,
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  amountLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  amountValue: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.m,
  },
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.m,
    padding: SPACING.m,
    marginBottom: SPACING.m,
    gap: SPACING.m,
  },
  methodCardActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  methodIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  methodSubtitle: {
    fontSize: 11.5,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: {
    borderColor: COLORS.primary,
  },
  radioDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: COLORS.primary,
  },
  secureNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: SPACING.s,
    gap: SPACING.xs,
  },
  secureNoteText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.textTertiary,
    lineHeight: 16,
  },
  bottomBar: {
    paddingHorizontal: SPACING.l,
    paddingTop: SPACING.m,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  placeOrderBtn: {
    backgroundColor: COLORS.ctaYellow,
    borderRadius: RADIUS.s,
    paddingVertical: SPACING.m,
    alignItems: 'center',
  },
  placeOrderText: {
    color: COLORS.textPrimary,
    fontWeight: '700',
    fontSize: 15,
  },
});

export default PaymentMethodScreen;
