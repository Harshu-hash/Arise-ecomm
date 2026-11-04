import React from 'react';
import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../../constants/colors';
import { SPACING, RADIUS } from '../../../constants/spacing';
import { StatusBarManager } from '../../../shared/components';
import FullScreenLoader from '../../../shared/loaders/FullScreenLoader';
import ErrorState from '../../../shared/ErrorState/ErrorState';
import {
  useGetNotificationPreferencesQuery,
  useUpdateNotificationPreferencesMutation,
} from '../api/notifications.api';
const rows = [
  ['orders', 'Order updates'],
  ['delivery', 'Delivery alerts'],
  ['offers', 'Offers and campaigns'],
  ['account', 'Account and security'],
  ['support', 'Support replies'],
];
const NotificationPreferencesScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets(),
    query = useGetNotificationPreferencesQuery(),
    [update, { isLoading }] = useUpdateNotificationPreferencesMutation();
  if (query.isLoading) return <FullScreenLoader message="Loading notification preferences..." />;
  if (query.error)
    return (
      <ErrorState
        title="Could not load preferences"
        message={query.error.message}
        onRetry={query.refetch}
      />
    );
  return (
    <View style={styles.container}>
      <StatusBarManager barStyle="dark-content" themeColor={COLORS.surface} />
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity onPress={navigation.goBack}>
          <Icon name="arrow-left" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notification Preferences</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.permission}>
          <Icon name="bell" size={18} color={COLORS.primary} />
          <View style={styles.grow}>
            <Text style={styles.permissionTitle}>
              Device push permission: {query.data.pushPermission.replace(/_/g, ' ').toLowerCase()}
            </Text>
            <Text style={styles.permissionText}>
              A token is registered only after the operating system grants permission. Until native
              FCM/APNs configuration is supplied, the in-app inbox remains available.
            </Text>
          </View>
        </View>
        <View style={styles.card}>
          {rows.map(([key, label]) => (
            <View key={key} style={styles.row}>
              <Text style={styles.label}>{label}</Text>
              <Switch
                disabled={isLoading}
                value={query.data[key]}
                onValueChange={value => update({ [key]: value })}
              />
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.m,
    paddingHorizontal: SPACING.l,
    paddingBottom: SPACING.m,
    backgroundColor: COLORS.surface,
  },
  headerTitle: { fontSize: 19, fontWeight: '600', color: COLORS.textPrimary },
  content: { padding: SPACING.l },
  permission: {
    flexDirection: 'row',
    gap: SPACING.m,
    padding: SPACING.l,
    borderRadius: RADIUS.m,
    backgroundColor: COLORS.primaryLight,
    marginBottom: SPACING.l,
  },
  grow: { flex: 1 },
  permissionTitle: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary },
  permissionText: { fontSize: 11.5, color: COLORS.textSecondary, lineHeight: 17, marginTop: 4 },
  card: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.m,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.l,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  label: { fontSize: 13.5, color: COLORS.textPrimary },
});
export default NotificationPreferencesScreen;
