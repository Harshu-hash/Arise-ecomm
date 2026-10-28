import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../../constants/colors';
import { SPACING } from '../../../constants/spacing';
import { StatusBarManager } from '../../../shared/components';

const SECTIONS = [
  {
    title: '1. Acceptance of Terms',
    body: 'By accessing or using this application, you agree to be bound by these Terms & Conditions and our Privacy Policy. If you do not agree, please discontinue use of the app.',
  },
  {
    title: '2. Account Registration',
    body: 'You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.',
  },
  {
    title: '3. Orders & Payments',
    body: 'All orders are subject to availability and confirmation. Prices, offers and delivery estimates are indicative and may change without prior notice.',
  },
  {
    title: '4. Returns & Refunds',
    body: 'Returns are accepted as per the applicable return window for each product. Refunds are processed to the original payment method within the stated timelines.',
  },
  {
    title: '5. User Conduct',
    body: 'You agree not to misuse the platform, including but not limited to posting false reviews, fraudulent orders, or attempting to breach platform security.',
  },
  {
    title: '6. Limitation of Liability',
    body: 'We are not liable for indirect, incidental or consequential damages arising from the use of this application, to the extent permitted by law.',
  },
  {
    title: '7. Changes to Terms',
    body: 'These terms may be updated periodically. Continued use of the app after changes constitutes acceptance of the revised terms.',
  },
];

const TermsConditionsScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <StatusBarManager barStyle="dark-content" themeColor={COLORS.surface} />

      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity onPress={() => navigation && navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Terms & Conditions</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.updatedText}>Last updated: 1 January 2026</Text>

        {SECTIONS.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionBody}>{section.body}</Text>
          </View>
        ))}
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
  updatedText: {
    fontSize: 12,
    color: COLORS.textTertiary,
    marginBottom: SPACING.l,
  },
  section: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  sectionBody: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 19,
  },
});

export default TermsConditionsScreen;
