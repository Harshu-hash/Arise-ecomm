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
  useGetCommunicationPreferencesQuery,
  useUpdateCommunicationPreferencesMutation,
} from '@features/privacy';
const rows = [
  ['orderUpdatesPush', 'Push order updates'],
  ['orderUpdatesEmail', 'Email order updates'],
  ['orderUpdatesSms', 'SMS order updates'],
  ['offersPush', 'Push offers'],
  ['offersEmail', 'Email offers'],
  ['offersSms', 'SMS offers'],
  ['recommendationsPush', 'Product recommendations'],
];
const CommunicationPreferencesScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets(),
    query = useGetCommunicationPreferencesQuery(),
    [update, { isLoading }] = useUpdateCommunicationPreferencesMutation();
  if (query.isLoading) return <FullScreenLoader message="Loading preferences..." />;
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
        <Text style={styles.headerTitle}>Communication Preferences</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.intro}>
          Choose how we contact you. Essential security and service messages may still be sent where
          required.
        </Text>
        <View style={styles.card}>
          {rows.map(([key, label]) => (
            <View key={key} style={styles.row}>
              <Text style={styles.label}>{label}</Text>
              <Switch
                disabled={isLoading}
                value={query.data[key]}
                onValueChange={value => update({ [key]: value })}
                trackColor={{ false: COLORS.border, true: COLORS.primaryLight }}
                thumbColor={query.data[key] ? COLORS.primary : COLORS.textTertiary}
              />
            </View>
          ))}
        </View>
        <Text style={styles.note}>Changes are saved to your account and apply across devices.</Text>
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
  intro: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 19, marginBottom: SPACING.l },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.m,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.l,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  label: { fontSize: 13.5, color: COLORS.textPrimary, flex: 1 },
  note: { fontSize: 11.5, color: COLORS.textTertiary, lineHeight: 17, marginTop: SPACING.l },
});
export default CommunicationPreferencesScreen;
