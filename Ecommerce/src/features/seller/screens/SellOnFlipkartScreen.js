import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../../constants/colors';
import { SPACING, RADIUS } from '../../../constants/spacing';
import { StatusBarManager } from '../../../shared/components';

const BENEFITS = [
  { id: 'b1', icon: 'users', title: 'Reach 500 Million+ Customers', subtitle: 'Sell to buyers across every corner of the country' },
  { id: 'b2', icon: 'truck', title: 'Easy Pickup & Delivery', subtitle: 'We handle logistics through our delivery network' },
  { id: 'b3', icon: 'credit-card', title: 'Fast, Secure Payments', subtitle: 'Get your payments in 7-15 days directly to your account' },
  { id: 'b4', icon: 'headphones', title: '24x7 Seller Support', subtitle: 'Dedicated support to help you grow your business' },
];

const STEPS = [
  { id: 's1', label: 'Register with GSTIN & bank details' },
  { id: 's2', label: 'List your products with price & photos' },
  { id: 's3', label: 'Start receiving orders & get paid' },
];

const SellOnFlipkartScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <StatusBarManager barStyle="dark-content" themeColor={COLORS.surface} />

      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity onPress={() => navigation && navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Sell on Flipkart</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.heroCard}>
          <Icon name="trending-up" size={26} color={COLORS.white} />
          <Text style={styles.heroTitle}>Grow Your Business Online</Text>
          <Text style={styles.heroSubtitle}>
            Join lakhs of sellers already growing with Flipkart. Zero setup cost to get started.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Why sell with us</Text>
        {BENEFITS.map((b) => (
          <View key={b.id} style={styles.benefitRow}>
            <View style={styles.benefitIconBox}>
              <Icon name={b.icon} size={18} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.benefitTitle}>{b.title}</Text>
              <Text style={styles.benefitSubtitle}>{b.subtitle}</Text>
            </View>
          </View>
        ))}

        <Text style={styles.sectionTitle}>Get started in 3 steps</Text>
        {STEPS.map((step, index) => (
          <View key={step.id} style={styles.stepRow}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>{index + 1}</Text>
            </View>
            <Text style={styles.stepLabel}>{step.label}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, SPACING.l) }]}>
        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.ctaBtn}
          onPress={() => navigation && navigation.navigate('SellerRegistration')}>
          <Text style={styles.ctaBtnText}>Start Selling</Text>
        </TouchableOpacity>
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
  },
  backBtn: {
    marginRight: SPACING.m,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '500',
    color: COLORS.textPrimary,
  },
  scrollContent: {
    paddingHorizontal: SPACING.l,
    paddingTop: SPACING.l,
    paddingBottom: SPACING.xxxl,
  },
  heroCard: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.m,
    padding: SPACING.xl,
    marginBottom: SPACING.xl,
  },
  heroTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: COLORS.white,
    marginTop: SPACING.m,
    marginBottom: SPACING.xs,
  },
  heroSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 18,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.m,
    marginTop: SPACING.s,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.l,
  },
  benefitIconBox: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.s,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.m,
  },
  benefitTitle: {
    fontSize: 13.5,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  benefitSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 16,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.m,
  },
  stepNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.mutedBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.m,
  },
  stepNumberText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  stepLabel: {
    flex: 1,
    fontSize: 13.5,
    color: COLORS.textPrimary,
  },
  footer: {
    paddingHorizontal: SPACING.l,
    paddingTop: SPACING.m,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  ctaBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.s,
    paddingVertical: SPACING.m,
    alignItems: 'center',
  },
  ctaBtnText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '700',
  },
});

export default SellOnFlipkartScreen;
