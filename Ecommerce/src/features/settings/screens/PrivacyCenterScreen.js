import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../../constants/colors';
import { SPACING, RADIUS } from '../../../constants/spacing';
import { StatusBarManager, AccountListRow } from '../../../shared/components';

const PRIVACY_ROWS = [
  {
    id: 'permissions',
    icon: 'toggle-right',
    label: 'Manage App Permissions',
    subtitle: 'Control camera, location, contacts & storage access',
    route: 'ManagePermissions',
  },
  {
    id: 'ads',
    icon: 'target',
    label: 'Ad Preferences',
    subtitle: 'Manage how your data is used to personalise ads',
    route: 'AdPreferences',
  },
  {
    id: 'download',
    icon: 'download',
    label: 'Download My Data',
    subtitle: 'Get a copy of the data we hold about you',
    route: 'DownloadData',
  },
  {
    id: 'delete',
    icon: 'trash-2',
    label: 'Delete My Account',
    subtitle: 'Permanently delete your account and all data',
    route: 'DeleteAccount',
  },
  {
    id: 'policy',
    icon: 'file-text',
    label: 'Privacy Policy',
    route: 'PrivacyPolicy',
  },
];

const PrivacyCenterScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <StatusBarManager barStyle="dark-content" themeColor={COLORS.surface} />

      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity onPress={() => navigation && navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Center</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.introCard}>
          <Icon name="shield" size={22} color={COLORS.primary} />
          <Text style={styles.introText}>
            Your privacy matters. Manage what data is collected, how it's used, and your account
            rights below.
          </Text>
        </View>

        <View style={styles.listGroup}>
          {PRIVACY_ROWS.map((row) => (
            <AccountListRow
              key={row.id}
              icon={row.icon}
              label={row.label}
              subtitle={row.subtitle}
              onPress={() => navigation && navigation.navigate(row.route)}
            />
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
    marginRight: SPACING.m,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '500',
    color: COLORS.textPrimary,
  },
  scrollContent: {
    paddingBottom: SPACING.xxxl,
  },
  introCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.primaryLight,
    marginHorizontal: SPACING.l,
    marginTop: SPACING.l,
    borderRadius: RADIUS.m,
    padding: SPACING.l,
    gap: SPACING.m,
  },
  introText: {
    flex: 1,
    fontSize: 12.5,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  listGroup: {
    marginTop: SPACING.l,
  },
});

export default PrivacyCenterScreen;
