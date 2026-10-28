import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../../constants/colors';
import { SPACING, RADIUS } from '../../../constants/spacing';
import { BottomSheetModal } from '../../../shared/components';
import { haptics } from '../../../utils/haptics';
import { useCart } from '../../../contexts/CartContext';

export const COUPONS = [
  { code: 'FLAT50', desc: 'Flat ₹50 off on orders above ₹500', amount: 50, minOrder: 500 },
  { code: 'WELCOME10', desc: '10% off up to ₹150 for new customers', amount: 150, minOrder: 300 },
  { code: 'SAVE20', desc: 'Flat ₹20 off, no minimum order', amount: 20, minOrder: 0 },
];

/**
 * The "Apply Coupon" row + picker sheet, shared by Cart and Checkout so a
 * coupon applied in either screen is visible in both (backed by CartContext).
 */
export default function CouponSection({ itemTotal }) {
  const { appliedCoupon, applyCoupon, clearCoupon } = useCart();
  const [visible, setVisible] = useState(false);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');

  const tryApply = (coupon) => {
    if (itemTotal < coupon.minOrder) {
      haptics.warning();
      setError(`Add ₹${coupon.minOrder - itemTotal} more to use this coupon`);
      return;
    }
    haptics.success();
    applyCoupon(coupon);
    setError('');
    setVisible(false);
  };

  const applyTyped = () => {
    const match = COUPONS.find((c) => c.code === input.trim().toUpperCase());
    if (!match) {
      setError('Invalid coupon code');
      return;
    }
    tryApply(match);
  };

  return (
    <View style={styles.sectionCard}>
      <TouchableOpacity activeOpacity={0.8} style={styles.couponRow} onPress={() => setVisible(true)}>
        <View style={[styles.couponIconCircle, appliedCoupon && styles.couponIconCircleActive]}>
          <Icon name="tag" size={15} color={appliedCoupon ? COLORS.white : COLORS.ratingGreen} />
        </View>
        {appliedCoupon ? (
          <View style={{ flex: 1, marginLeft: SPACING.m }}>
            <Text style={styles.couponApplied}>{`'${appliedCoupon.code}' applied`}</Text>
            <Text style={styles.couponSavedText}>{`You saved ₹${appliedCoupon.amount} on this order`}</Text>
          </View>
        ) : (
          <View style={{ flex: 1, marginLeft: SPACING.m }}>
            <Text style={styles.couponRowText}>Apply Coupon</Text>
            <Text style={styles.couponRowSubtext}>View available offers</Text>
          </View>
        )}
        {appliedCoupon ? (
          <TouchableOpacity onPress={() => { clearCoupon(); setError(''); }}>
            <Text style={styles.couponRemove}>Remove</Text>
          </TouchableOpacity>
        ) : (
          <Icon name="chevron-right" size={18} color={COLORS.textTertiary} />
        )}
      </TouchableOpacity>

      <BottomSheetModal visible={visible} onClose={() => setVisible(false)}>
        <View style={styles.sheetContent}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Apply Coupon</Text>
          <View style={styles.couponInputRow}>
            <TextInput
              style={styles.couponInput}
              value={input}
              onChangeText={(t) => { setInput(t); setError(''); }}
              placeholder="Enter coupon code"
              placeholderTextColor={COLORS.textTertiary}
              autoCapitalize="characters"
            />
            <TouchableOpacity style={styles.couponApplyBtn} onPress={applyTyped}>
              <Text style={styles.couponApplyText}>Apply</Text>
            </TouchableOpacity>
          </View>
          {error ? (
            <View style={styles.couponErrorRow}>
              <Icon name="alert-circle" size={13} color={COLORS.error} />
              <Text style={styles.couponErrorText}>{error}</Text>
            </View>
          ) : null}

          <Text style={styles.sheetSubtitle}>Available Coupons</Text>
          {COUPONS.map((coupon) => (
            <TouchableOpacity key={coupon.code} activeOpacity={0.8} style={styles.couponCard} onPress={() => tryApply(coupon)}>
              <View style={styles.couponCardIconCircle}>
                <Icon name="tag" size={16} color={COLORS.ratingGreen} />
              </View>
              <View style={{ flex: 1, marginLeft: SPACING.m }}>
                <Text style={styles.couponCode}>{coupon.code}</Text>
                <Text style={styles.couponDesc}>{coupon.desc}</Text>
              </View>
              <Text style={styles.couponApplyLink}>APPLY</Text>
            </TouchableOpacity>
          ))}
        </View>
      </BottomSheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
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
  couponRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  couponIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.ratingGreenBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  couponIconCircleActive: {
    backgroundColor: COLORS.ratingGreen,
  },
  couponRowText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  couponRowSubtext: {
    fontSize: 11.5,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  couponApplied: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.ratingGreen,
  },
  couponSavedText: {
    fontSize: 11.5,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  couponRemove: {
    fontSize: 12.5,
    fontWeight: '700',
    color: COLORS.error,
  },
  sheetContent: {
    padding: SPACING.l,
    paddingBottom: SPACING.xxxl,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    marginBottom: SPACING.m,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.m,
  },
  couponInputRow: {
    flexDirection: 'row',
    gap: SPACING.s,
  },
  couponInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.s,
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.m,
    fontSize: 13.5,
    color: COLORS.textPrimary,
  },
  couponApplyBtn: {
    justifyContent: 'center',
    paddingHorizontal: SPACING.l,
    borderRadius: RADIUS.s,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  couponApplyText: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 13.5,
  },
  couponErrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: SPACING.s,
  },
  couponErrorText: {
    fontSize: 12,
    color: COLORS.error,
  },
  sheetSubtitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: SPACING.xl,
    marginBottom: SPACING.m,
  },
  couponCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.m,
    padding: SPACING.m,
    marginBottom: SPACING.m,
  },
  couponCardIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.ratingGreenBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  couponCode: {
    fontSize: 13.5,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  couponDesc: {
    fontSize: 11.5,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  couponApplyLink: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.primary,
  },
});
