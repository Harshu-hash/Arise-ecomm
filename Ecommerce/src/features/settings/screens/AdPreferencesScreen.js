import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../../constants/colors';
import { SPACING } from '../../../constants/spacing';
import { StatusBarManager } from '../../../shared/components';
import FullScreenLoader from '../../../shared/loaders/FullScreenLoader';
import ErrorState from '../../../shared/ErrorState/ErrorState';
import { useGetAdPreferencesQuery, useUpdateAdPreferencesMutation } from '../api/settings.api';

const AdPreferencesScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { data, isLoading, error, refetch } = useGetAdPreferencesQuery();
  const [updatePreferences, { isLoading: isSaving }] = useUpdateAdPreferencesMutation();
  const preferences = data?.items || [];

  const toggle = preference =>
    updatePreferences({
      personalizedAds: data.personalizedAds,
      thirdPartyDataSharing: data.thirdPartyDataSharing,
      locationBasedAds: data.locationBasedAds,
      [preference.id]: !preference.enabled,
    });

  if (isLoading) return <FullScreenLoader message="Loading privacy preferences..." />;
  if (error && !data) return <ErrorState message={error.message} onRetry={refetch} />;

  return (
    <View style={styles.container}>
      <StatusBarManager barStyle="dark-content" themeColor={COLORS.surface} />

      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity onPress={() => navigation && navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ad Preferences</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.introText}>
          Manage how your data is used to personalise the ads and offers you see across the app.
        </Text>

        {preferences.map((pref) => (
          <View key={pref.id} style={styles.row}>
            <View style={styles.textBox}>
              <Text style={styles.label}>{pref.label}</Text>
              <Text style={styles.subtitle}>{pref.subtitle}</Text>
            </View>
            <Switch
              value={pref.enabled}
              disabled={isSaving}
              onValueChange={() => toggle(pref)}
              trackColor={{ false: COLORS.border, true: COLORS.primaryLight }}
              thumbColor={pref.enabled ? COLORS.primary : COLORS.textTertiary}
            />
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
    fontSize: 19,
    fontWeight: '500',
    color: COLORS.textPrimary,
  },
  scrollContent: {
    paddingHorizontal: SPACING.l,
    paddingTop: SPACING.l,
    paddingBottom: SPACING.xxxl,
  },
  introText: {
    fontSize: 12.5,
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginBottom: SPACING.l,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.m,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  textBox: {
    flex: 1,
    marginRight: SPACING.m,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 11.5,
    color: COLORS.textSecondary,
    lineHeight: 15,
  },
});

export default AdPreferencesScreen;
