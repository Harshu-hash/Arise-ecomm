import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../../constants/colors';
import { SPACING, RADIUS } from '../../../constants/spacing';
import { StatusBarManager } from '../../../shared/components';
import PressableScale from '../../../shared/ui/PressableScale';
import CouponSection from '../../cart/components/CouponSection';
import { haptics } from '../../../utils/haptics';
import { useGetCartQuery, useUpdateCartItemMutation } from '@features/cart';
import FullScreenLoader from '../../../shared/loaders/FullScreenLoader';
import ErrorState from '../../../shared/ErrorState/ErrorState';
import { useToast } from '../../../contexts/ToastContext';
import { useGetAddressesQuery } from '@features/address';
import { useCreateCheckoutSessionMutation } from '../api/checkout.query';

const SectionBadge = ({ number }) => (
  <View style={styles.sectionBadge}>
    <Text style={styles.sectionBadgeText}>{number}</Text>
  </View>
);

const MAX_QTY = 10;
const MIN_QTY = 1;

const CheckoutScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const directPurchase = Boolean(route?.params?.items?.length);
  const [directItems, setDirectItems] = useState(route?.params?.items ?? []);
  const { data: cart, error, isLoading, refetch } = useGetCartQuery();
  const {
    data: addressBook,
    error: addressError,
    isLoading: isLoadingAddresses,
    refetch: refetchAddresses,
  } = useGetAddressesQuery();
  const [updateCartItem] = useUpdateCartItemMutation();
  const [createCheckoutSession, { isLoading: isCreatingSession }] =
    useCreateCheckoutSessionMutation();
  const toast = useToast();
  const items = directPurchase ? directItems : (cart?.items ?? []);
  const appliedCoupon = directPurchase ? null : cart?.appliedCoupon;
  const [selectedAddressId, setSelectedAddressId] = useState(route?.params?.selectedAddressId);
  const address =
    addressBook?.items.find(item => item.id === selectedAddressId) ||
    addressBook?.items.find(item => item.isDefault) ||
    addressBook?.items[0];

  useFocusEffect(
    useCallback(() => {
      const selected = route?.params?.selectedAddressId;
      if (selected) {
        setSelectedAddressId(selected);
        navigation.setParams({ selectedAddressId: undefined });
      }
    }, [route?.params?.selectedAddressId, navigation]),
  );

  const calculatedItemTotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const calculatedMrpTotal = items.reduce(
    (sum, item) => sum + (item.mrp || item.price) * item.qty,
    0,
  );
  const itemTotal = directPurchase ? calculatedItemTotal : (cart?.totals.subtotal ?? 0);
  const mrpTotal = directPurchase ? calculatedMrpTotal : (cart?.totals.mrp ?? 0);
  const deliveryFee = directPurchase
    ? calculatedItemTotal >= 500
      ? 0
      : 40
    : (cart?.totals.deliveryFee ?? 0);
  const platformFee = directPurchase ? 5 : (cart?.totals.platformFee ?? 0);
  const productDiscount = directPurchase
    ? calculatedMrpTotal - calculatedItemTotal
    : (cart?.totals.productDiscount ?? 0);
  const couponDiscount = directPurchase ? 0 : (cart?.totals.couponDiscount ?? 0);
  const totalSavings = productDiscount + couponDiscount;
  const grandTotal = directPurchase
    ? Math.max(itemTotal + deliveryFee + platformFee, 0)
    : (cart?.totals.payable ?? 0);

  const handleQtyChange = async (item, delta) => {
    if (directPurchase) {
      setDirectItems(prev =>
        prev.map(entry =>
          entry.id === item.id
            ? { ...entry, qty: Math.min(MAX_QTY, Math.max(MIN_QTY, entry.qty + delta)) }
            : entry,
        ),
      );
      return;
    }
    try {
      await updateCartItem({ cartItemId: item.id, quantity: item.qty + delta }).unwrap();
    } catch (mutationError) {
      toast.show(mutationError.message || 'Could not update the quantity.');
    }
  };

  const handleContinue = async () => {
    haptics.medium();
    const source = directPurchase ? 'BUY_NOW' : 'CART';
    const requestItems = directPurchase
      ? items.map(item => ({
          productId: item.productId || item.id,
          variantLabel: item.variant || 'Standard',
          quantity: item.qty,
        }))
      : undefined;
    const identity = directPurchase
      ? requestItems
          .map(item => `${item.productId}:${item.variantLabel}:${item.quantity}`)
          .join('|')
      : `${cart.id}:${cart.version}`;
    try {
      const session = await createCheckoutSession({
        source,
        addressId: address.id,
        cartVersion: directPurchase ? undefined : cart.version,
        items: requestItems,
        idempotencyKey: `checkout:${identity}:${address.id}`,
      }).unwrap();
      navigation?.navigate('PaymentMethod', { checkoutSessionId: session.id });
    } catch (mutationError) {
      toast.show(mutationError.message || 'Could not start checkout. Please try again.');
    }
  };

  if ((!directPurchase && isLoading) || isLoadingAddresses) {
    return <FullScreenLoader message="Preparing checkout..." />;
  }
  if (!directPurchase && error && !cart) {
    return <ErrorState message={error.message} onRetry={refetch} />;
  }
  if (!items.length) {
    return (
      <ErrorState
        title="Your cart is empty"
        message="Add at least one item before starting checkout."
      />
    );
  }
  if (addressError && !addressBook) {
    return <ErrorState message={addressError.message} onRetry={refetchAddresses} />;
  }
  if (!address) {
    return (
      <ErrorState
        title="Delivery address required"
        message="Add a serviceable delivery address before continuing to payment."
      />
    );
  }

  return (
    <View style={styles.container}>
      <StatusBarManager barStyle="dark-content" themeColor={COLORS.surface} />

      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity onPress={() => navigation && navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Checkout</Text>
          <Text style={styles.headerSubtitle}>
            {items.length} item{items.length > 1 ? 's' : ''} · ₹{grandTotal}
          </Text>
        </View>
        <View style={styles.secureChip}>
          <Icon name="lock" size={11} color={COLORS.ratingGreen} />
          <Text style={styles.secureChipText}>Secure</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Address */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionTopRow}>
            <View style={styles.sectionTitleRow}>
              <SectionBadge number="1" />
              <Text style={styles.sectionTitle}>Deliver to</Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.changeBtn}
              onPress={() =>
                navigation &&
                navigation.navigate('SavedAddresses', {
                  selectMode: true,
                  returnScreen: 'Checkout',
                })
              }
            >
              <Text style={styles.changeText}>Change</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.addressCard}>
            <View style={styles.addressCardTopRow}>
              <View style={styles.labelPill}>
                <Icon
                  name={address.label === 'Work' ? 'briefcase' : 'home'}
                  size={11}
                  color={COLORS.primary}
                />
                <Text style={styles.labelPillText}>{address.label}</Text>
              </View>
              {address.isDefault ? (
                <View style={styles.defaultPill}>
                  <Text style={styles.defaultPillText}>DEFAULT</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.addressName}>
              {address.name} <Text style={styles.addressPhone}>· {address.phone}</Text>
            </Text>
            <Text style={styles.addressLine}>{address.line}</Text>
            <Text style={styles.addressLine}>{address.cityLine}</Text>
          </View>
        </View>

        {/* Order summary */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionTitleRow}>
            <SectionBadge number="2" />
            <Text style={styles.sectionTitle}>
              Order Summary{' '}
              <Text style={styles.sectionTitleMuted}>
                ({items.length} item{items.length > 1 ? 's' : ''})
              </Text>
            </Text>
          </View>
          {items.map((item, idx) => (
            <View key={item.id} style={[styles.itemRow, idx > 0 && styles.itemRowDivider]}>
              <View style={styles.itemImageBox}>
                <Image source={{ uri: item.image }} style={styles.itemImage} resizeMode="cover" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName} numberOfLines={2}>
                  {item.name}
                </Text>
                {item.variant ? <Text style={styles.itemVariant}>{item.variant}</Text> : null}
                <View style={styles.itemBottomRow}>
                  <View style={styles.qtyStepper}>
                    <PressableScale
                      disabled={item.qty <= MIN_QTY}
                      haptic="light"
                      onPress={() => handleQtyChange(item, -1)}
                      style={[
                        styles.qtyStepperBtn,
                        item.qty <= MIN_QTY && styles.qtyStepperBtnDisabled,
                      ]}
                    >
                      <Icon
                        name="minus"
                        size={13}
                        color={item.qty <= MIN_QTY ? COLORS.textTertiary : COLORS.primary}
                      />
                    </PressableScale>
                    <Text style={styles.qtyStepperValue}>{item.qty}</Text>
                    <PressableScale
                      disabled={item.qty >= MAX_QTY}
                      haptic="light"
                      onPress={() => handleQtyChange(item, 1)}
                      style={[
                        styles.qtyStepperBtn,
                        item.qty >= MAX_QTY && styles.qtyStepperBtnDisabled,
                      ]}
                    >
                      <Icon
                        name="plus"
                        size={13}
                        color={item.qty >= MAX_QTY ? COLORS.textTertiary : COLORS.primary}
                      />
                    </PressableScale>
                  </View>
                  <Text style={styles.itemPrice}>₹{item.price * item.qty}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* Coupon */}
        {!directPurchase ? <CouponSection cartId={cart.id} /> : null}

        {/* Price details */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Price Details</Text>

          {totalSavings > 0 ? (
            <View style={styles.savingsBanner}>
              <Icon name="check-circle" size={14} color={COLORS.ratingGreen} />
              <Text style={styles.savingsBannerText}>
                Your Total Savings on this order{' '}
                <Text style={styles.savingsBannerAmount}>₹{totalSavings}</Text>
              </Text>
            </View>
          ) : null}

          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Item Total (MRP)</Text>
            <Text style={styles.priceValue}>₹{mrpTotal}</Text>
          </View>
          {productDiscount > 0 ? (
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Product Discount</Text>
              <Text style={[styles.priceValue, styles.discountValue]}>-₹{productDiscount}</Text>
            </View>
          ) : null}
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Delivery Fee</Text>
            <Text style={[styles.priceValue, deliveryFee === 0 && styles.discountValue]}>
              {deliveryFee === 0 ? 'FREE' : `₹${deliveryFee}`}
            </Text>
          </View>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Platform Fee</Text>
            <Text style={styles.priceValue}>₹{platformFee}</Text>
          </View>
          {appliedCoupon ? (
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Coupon Discount ({appliedCoupon.code})</Text>
              <Text style={[styles.priceValue, styles.discountValue]}>
                -₹{appliedCoupon.amount}
              </Text>
            </View>
          ) : null}
          <View style={styles.priceDivider} />
          <View style={styles.priceRow}>
            <Text style={styles.grandLabel}>Total Payable</Text>
            <Text style={styles.grandValue}>₹{grandTotal}</Text>
          </View>
        </View>

        {/* Trust strip */}
        <View style={styles.trustStrip}>
          <View style={styles.trustItem}>
            <Icon name="shield" size={16} color={COLORS.primary} />
            <Text style={styles.trustText}>Safe Payments</Text>
          </View>
          <View style={styles.trustDivider} />
          <View style={styles.trustItem}>
            <Icon name="refresh-ccw" size={16} color={COLORS.primary} />
            <Text style={styles.trustText}>Easy Returns</Text>
          </View>
          <View style={styles.trustDivider} />
          <View style={styles.trustItem}>
            <Icon name="truck" size={16} color={COLORS.primary} />
            <Text style={styles.trustText}>Fast Delivery</Text>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={{ flex: 1 }}>
          {mrpTotal > grandTotal ? <Text style={styles.bottomMrp}>₹{mrpTotal}</Text> : null}
          <View style={styles.bottomTotalRow}>
            <Text style={styles.bottomTotal}>₹{grandTotal}</Text>
          </View>
          {totalSavings > 0 ? (
            <Text style={styles.bottomSavings}>You save ₹{totalSavings}</Text>
          ) : (
            <Text style={styles.bottomTotalLabel}>Total Amount</Text>
          )}
        </View>
        <PressableScale
          disabled={isCreatingSession}
          haptic={false}
          onPress={handleContinue}
          style={styles.continueBtn}
        >
          <Text style={styles.continueText}>
            {isCreatingSession ? 'Securing prices...' : 'Continue'}
          </Text>
          <Icon name="arrow-right" size={16} color={COLORS.textPrimary} />
        </PressableScale>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.mutedBg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.l,
    paddingBottom: SPACING.m,
    gap: SPACING.m,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    zIndex: 1,
  },
  backBtn: {
    padding: 2,
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  headerSubtitle: {
    fontSize: 11.5,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  secureChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.ratingGreenBg,
    borderRadius: RADIUS.round,
    paddingHorizontal: SPACING.s,
    paddingVertical: 4,
    gap: 4,
  },
  secureChipText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: COLORS.ratingGreen,
  },
  scrollContent: {
    padding: SPACING.l,
    paddingBottom: 130,
  },
  sectionCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.l,
    padding: SPACING.l,
    marginBottom: SPACING.m,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  sectionTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.s,
  },
  sectionBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.primary,
  },
  sectionTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  sectionTitleMuted: {
    fontWeight: '500',
    color: COLORS.textSecondary,
  },
  changeBtn: {
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: RADIUS.round,
    paddingHorizontal: SPACING.m,
    paddingVertical: 5,
  },
  changeText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  addressCard: {
    marginTop: SPACING.m,
    backgroundColor: COLORS.mutedBg,
    borderRadius: RADIUS.m,
    padding: SPACING.m,
    borderWidth: 1,
    borderColor: COLORS.primaryLight,
  },
  addressCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.s,
  },
  labelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xs,
    paddingHorizontal: SPACING.s,
    paddingVertical: 3,
    gap: 4,
  },
  labelPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  defaultPill: {
    borderWidth: 1,
    borderColor: COLORS.success,
    borderRadius: RADIUS.xs,
    paddingHorizontal: SPACING.s,
    paddingVertical: 3,
  },
  defaultPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.success,
  },
  addressName: {
    fontSize: 13.5,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  addressPhone: {
    fontWeight: '500',
    color: COLORS.textSecondary,
  },
  addressLine: {
    fontSize: 12.5,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.l,
    gap: SPACING.m,
  },
  itemRowDivider: {
    paddingTop: SPACING.l,
    marginTop: SPACING.l,
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBorder,
  },
  itemImageBox: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.s,
    backgroundColor: COLORS.mutedBg,
    overflow: 'hidden',
  },
  itemImage: {
    width: '100%',
    height: '100%',
  },
  itemName: {
    fontSize: 12.5,
    color: COLORS.textPrimary,
    lineHeight: 17,
  },
  itemVariant: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  itemBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.xs,
  },
  qtyStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.round,
    overflow: 'hidden',
  },
  qtyStepperBtn: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primaryLight,
  },
  qtyStepperBtnDisabled: {
    backgroundColor: COLORS.mutedBg,
  },
  qtyStepperValue: {
    minWidth: 26,
    textAlign: 'center',
    fontSize: 12.5,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  itemPrice: {
    fontSize: 13.5,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  savingsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.ratingGreenBg,
    borderRadius: RADIUS.s,
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s + 2,
    marginTop: SPACING.m,
    marginBottom: SPACING.s,
    gap: SPACING.s,
  },
  savingsBannerText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.ratingGreen,
  },
  savingsBannerAmount: {
    fontWeight: '800',
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.m,
  },
  priceLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  priceValue: {
    fontSize: 13,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  discountValue: {
    color: COLORS.ratingGreen,
  },
  priceDivider: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    borderStyle: 'dashed',
    marginTop: SPACING.m,
  },
  grandLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginTop: SPACING.m,
  },
  grandValue: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginTop: SPACING.m,
  },
  trustStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.l,
    paddingVertical: SPACING.m,
    marginBottom: SPACING.m,
  },
  trustItem: {
    alignItems: 'center',
    gap: 4,
  },
  trustText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  trustDivider: {
    width: 1,
    height: 26,
    backgroundColor: COLORS.border,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.white,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingHorizontal: SPACING.l,
    paddingTop: SPACING.m,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 6,
  },
  bottomMrp: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textDecorationLine: 'line-through',
  },
  bottomTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bottomTotal: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  bottomTotalLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  bottomSavings: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.ratingGreen,
    marginTop: 1,
  },
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.ctaYellow,
    paddingHorizontal: SPACING.xxl,
    paddingVertical: SPACING.m,
    borderRadius: RADIUS.round,
    gap: SPACING.s,
  },
  continueText: {
    color: COLORS.textPrimary,
    fontWeight: '700',
    fontSize: 14,
  },
});

export default CheckoutScreen;
