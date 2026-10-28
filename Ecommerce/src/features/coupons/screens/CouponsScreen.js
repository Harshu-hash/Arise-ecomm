import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { COLORS } from '../../../constants/colors';
import { SPACING, RADIUS } from '../../../constants/spacing';
import { StatusBarManager } from '../../../shared/components';
import { useToast } from '../../../contexts/ToastContext';
import { haptics } from '../../../utils/haptics';

const COUPON_BANNER = require('../../../assets/images/coupon_banner.png');

const COUPONS = [
  {
    id: 'c1',
    code: 'WELCOME50',
    title: 'Flat ₹50 off',
    subtitle: 'On your first order above ₹199',
    expiry: 'Expires 30 Sep',
  },
  {
    id: 'c2',
    code: 'FRESH20',
    title: '20% off on Grocery',
    subtitle: 'Max discount ₹100 · Min order ₹499',
    expiry: 'Expires 15 Oct',
  },
  {
    id: 'c3',
    code: 'FASHION150',
    title: 'Flat ₹150 off Fashion',
    subtitle: 'On orders above ₹999',
    expiry: 'Expires 05 Oct',
  },
  {
    id: 'c4',
    code: 'SUPER10',
    title: '10% cashback',
    subtitle: 'On UPI payments · Max ₹75',
    expiry: 'Expires 20 Oct',
  },
];

const CouponsScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [copiedId, setCopiedId] = useState(null);
  const toast = useToast();

  const handleBack = () => {
    if (navigation && navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation && navigation.navigate('MainTabs', { screen: 'Home' });
    }
  };

  const handleCopy = (coupon) => {
    setCopiedId(coupon.id);
    haptics.success();
    toast.show(`${coupon.code} copied`, { icon: 'check', variant: 'success' });
  };

  return (
    <View style={styles.container}>
      <StatusBarManager barStyle="dark-content" themeColor={COLORS.surface} />

      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn} activeOpacity={0.7}>
          <Icon name="arrow-left" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Your Coupons</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.bannerContainer}>
          <Image source={COUPON_BANNER} style={styles.bannerImage} resizeMode="contain" />
          <Svg
            style={StyleSheet.absoluteFill}
            width="100%"
            height="100%"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            pointerEvents="none">
            <Defs>
              <LinearGradient id="headerWhiteBlend" x1="0%" y1="0%" x2="0%" y2="100%">
                <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.9" />
                <Stop offset="12%" stopColor="#FFFFFF" stopOpacity="0.5" />
                <Stop offset="25%" stopColor="#FFFFFF" stopOpacity="0.15" />
                <Stop offset="40%" stopColor="#FFFFFF" stopOpacity="0" />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100" height="100" fill="url(#headerWhiteBlend)" />
          </Svg>
        </View>

        <View style={styles.couponsList}>
          {COUPONS.map((coupon) => (
            <View key={coupon.id} style={styles.couponCard}>
              <View style={styles.couponIconWrap}>
                <Icon name="gift" size={20} color={COLORS.primary} />
              </View>

              <View style={styles.couponBody}>
                <Text style={styles.couponTitle}>{coupon.title}</Text>
                <Text style={styles.couponSubtitle}>{coupon.subtitle}</Text>

                <View style={styles.couponBottomRow}>
                  <View style={styles.codeChip}>
                    <Text style={styles.codeChipText}>{coupon.code}</Text>
                  </View>
                  <Text style={styles.expiryText}>{coupon.expiry}</Text>
                </View>
              </View>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => handleCopy(coupon)}
                style={styles.copyBtn}>
                <Text style={styles.copyBtnText}>
                  {copiedId === coupon.id ? 'Copied' : 'Copy'}
                </Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </ScrollView>
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
  },
  backBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  bannerContainer: {
    width: '108%',
    marginLeft: '-4%',
    aspectRatio: 1368 / 1149,
    overflow: 'hidden',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  couponsList: {
    padding: SPACING.l,
  },
  couponCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.m,
    padding: SPACING.m,
    marginBottom: SPACING.m,
    backgroundColor: COLORS.surface,
  },
  couponIconWrap: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.round,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.m,
  },
  couponBody: {
    flex: 1,
  },
  couponTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  couponSubtitle: {
    fontSize: 12.5,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  couponBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.s,
    gap: SPACING.s,
  },
  codeChip: {
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
    borderRadius: RADIUS.xs,
    paddingHorizontal: SPACING.s,
    paddingVertical: 3,
  },
  codeChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
    letterSpacing: 0.5,
  },
  expiryText: {
    fontSize: 11.5,
    color: COLORS.textTertiary,
  },
  copyBtn: {
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: RADIUS.s,
    paddingHorizontal: SPACING.m,
    paddingVertical: 6,
    marginLeft: SPACING.s,
  },
  copyBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: COLORS.primary,
  },
});

export default CouponsScreen;
