import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../../constants/colors';
import { SPACING, RADIUS } from '../../../constants/spacing';
import { StatusBarManager } from '../../../shared/components';

const LINKS = [
  { id: 'website', icon: 'globe', label: 'Visit our website' },
  { id: 'careers', icon: 'briefcase', label: 'Careers' },
  { id: 'press', icon: 'file-text', label: 'Press & Media' },
  { id: 'social', icon: 'share-2', label: 'Follow us on social media' },
];

const AboutScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <StatusBarManager barStyle="dark-content" themeColor={COLORS.surface} />

      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity onPress={() => navigation && navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>About Flipkart</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.logoBox}>
          <Icon name="shopping-bag" size={30} color={COLORS.primary} />
        </View>
        <Text style={styles.appName}>Flipkart</Text>
        <Text style={styles.versionText}>Version 1.0.0</Text>

        <Text style={styles.description}>
          Flipkart is India's leading e-commerce marketplace, offering a wide range of products
          across categories including electronics, fashion, home essentials and more — delivered
          to your doorstep with trusted quality and secure payments.
        </Text>

        <View style={styles.listGroup}>
          {LINKS.map((link) => (
            <TouchableOpacity key={link.id} activeOpacity={0.7} style={styles.linkRow}>
              <Icon name={link.icon} size={18} color={COLORS.primary} style={styles.linkIcon} />
              <Text style={styles.linkLabel}>{link.label}</Text>
              <Icon name="chevron-right" size={16} color={COLORS.textTertiary} />
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.copyright}>© 2026 Flipkart Internet Private Limited</Text>
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
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.xxxl,
    alignItems: 'center',
  },
  logoBox: {
    width: 68,
    height: 68,
    borderRadius: RADIUS.l,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.m,
  },
  appName: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  versionText: {
    fontSize: 12.5,
    color: COLORS.textTertiary,
    marginTop: 2,
    marginBottom: SPACING.xl,
  },
  description: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  listGroup: {
    alignSelf: 'stretch',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.m,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  linkIcon: {
    marginRight: SPACING.m,
  },
  linkLabel: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  copyright: {
    fontSize: 11.5,
    color: COLORS.textTertiary,
    marginTop: SPACING.xl,
  },
});

export default AboutScreen;
