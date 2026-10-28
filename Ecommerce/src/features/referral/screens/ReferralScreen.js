import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Share } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../../constants/colors';
import { SPACING, RADIUS } from '../../../constants/spacing';
import { StatusBarManager } from '../../../shared/components';
import { useToast } from '../../../contexts/ToastContext';
import { haptics } from '../../../utils/haptics';

const REFERRAL_CODE = 'ARISE-HARSH50';

const HOW_IT_WORKS = [
  { id: 1, icon: 'share-2', text: 'Share your referral code with friends' },
  { id: 2, icon: 'user-plus', text: 'They sign up and shop using your code' },
  { id: 3, icon: 'gift', text: 'You both get ₹50 cashback in your wallet' },
];

const ReferralScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [copied, setCopied] = useState(false);
  const toast = useToast();

  const handleBack = () => {
    if (navigation && navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation && navigation.navigate('MainTabs', { screen: 'Account' });
    }
  };

  const handleCopy = () => {
    setCopied(true);
    haptics.success();
    toast.show('Referral code copied', { icon: 'check', variant: 'success' });
    setTimeout(() => setCopied(false), 1800);
  };

  const handleShare = () => {
    Share.share({
      message: `Use my referral code ${REFERRAL_CODE} on Arise and we both get ₹50 cashback!`,
    }).catch(() => {});
  };

  return (
    <View style={styles.container}>
      <StatusBarManager barStyle="dark-content" themeColor={COLORS.surface} />

      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn} activeOpacity={0.7}>
          <Icon name="arrow-left" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Refer & Earn</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.heroCard}>
          <Icon name="gift" size={28} color={COLORS.white} />
          <Text style={styles.heroTitle}>Give ₹50, Get ₹50</Text>
          <Text style={styles.heroSubtitle}>Invite friends to Arise and earn wallet cashback for every signup</Text>

          <View style={styles.codeChip}>
            <Text style={styles.codeChipText}>{REFERRAL_CODE}</Text>
            <TouchableOpacity activeOpacity={0.8} onPress={handleCopy} style={styles.copyBtn}>
              <Text style={styles.copyBtnText}>{copied ? 'Copied' : 'Copy'}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity activeOpacity={0.85} onPress={handleShare} style={styles.shareBtn}>
            <Text style={styles.shareBtnText}>Share Invite</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>How it works</Text>
        {HOW_IT_WORKS.map((step) => (
          <View key={step.id} style={styles.stepRow}>
            <View style={styles.stepIconCircle}>
              <Icon name={step.icon} size={18} color={COLORS.primary} />
            </View>
            <Text style={styles.stepText}>{step.text}</Text>
          </View>
        ))}

        <View style={styles.earningsRow}>
          <Text style={styles.earningsLabel}>Your referral earnings</Text>
          <Text style={styles.earningsValue}>₹0</Text>
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
    padding: SPACING.l,
    paddingBottom: SPACING.xxl,
  },
  heroCard: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.l,
    padding: SPACING.xl,
    alignItems: 'center',
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.white,
    marginTop: SPACING.s,
  },
  heroSubtitle: {
    fontSize: 12.5,
    color: COLORS.white,
    opacity: 0.9,
    textAlign: 'center',
    marginTop: SPACING.xs,
    lineHeight: 18,
  },
  codeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    borderStyle: 'dashed',
    borderRadius: RADIUS.s,
    paddingHorizontal: SPACING.l,
    paddingVertical: SPACING.m,
    marginTop: SPACING.xl,
    alignSelf: 'stretch',
  },
  codeChipText: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: 0.5,
  },
  copyBtn: {
    paddingHorizontal: SPACING.m,
    paddingVertical: 4,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.s,
  },
  copyBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  shareBtn: {
    marginTop: SPACING.l,
    alignSelf: 'stretch',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.m,
    paddingVertical: SPACING.m,
    alignItems: 'center',
  },
  shareBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: SPACING.xl,
    marginBottom: SPACING.m,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.m,
  },
  stepIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.m,
  },
  stepText: {
    flex: 1,
    fontSize: 13.5,
    color: COLORS.textPrimary,
  },
  earningsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.m,
    padding: SPACING.l,
    marginTop: SPACING.l,
  },
  earningsLabel: {
    fontSize: 13.5,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  earningsValue: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.ratingGreen,
  },
});

export default ReferralScreen;
