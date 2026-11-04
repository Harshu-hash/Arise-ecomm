import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../../constants/colors';
import { SPACING, RADIUS } from '../../../constants/spacing';
import { StatusBarManager } from '../../../shared/components';
import FullScreenLoader from '../../../shared/loaders/FullScreenLoader';
import ErrorState from '../../../shared/ErrorState/ErrorState';
import { useCreateExportRequestMutation, useGetExportRequestQuery } from '@features/privacy';
const categories = [
  'Profile information',
  'Order history',
  'Saved addresses',
  'Reviews and questions',
  'Account activity',
];
const DownloadDataScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets(),
    query = useGetExportRequestQuery(),
    [create, { isLoading }] = useCreateExportRequestMutation();
  if (query.isLoading) return <FullScreenLoader message="Checking export status..." />;
  if (query.error)
    return (
      <ErrorState
        title="Could not load export status"
        message={query.error.message}
        onRetry={query.refetch}
      />
    );
  const request = query.data;
  return (
    <View style={styles.container}>
      <StatusBarManager barStyle="dark-content" themeColor={COLORS.surface} />
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity onPress={navigation.goBack}>
          <Icon name="arrow-left" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Download My Data</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.intro}>
          Request a portable copy of the personal data associated with your account.
        </Text>
        {categories.map(item => (
          <View key={item} style={styles.row}>
            <Icon name="check" size={15} color={COLORS.primary} />
            <Text style={styles.rowText}>{item}</Text>
          </View>
        ))}
        <Text style={styles.note}>
          The server will prepare the export within the displayed deadline. A secure download link
          will be available only after processing completes.
        </Text>
        {request ? (
          <View style={styles.status}>
            <Icon
              name={request.status === 'READY' ? 'check-circle' : 'clock'}
              size={18}
              color={COLORS.primary}
            />
            <View style={styles.grow}>
              <Text style={styles.statusTitle}>Export {request.status.toLowerCase()}</Text>
              <Text style={styles.statusText}>
                Requested {new Date(request.requestedAt).toLocaleString('en-IN')} · Ready by{' '}
                {new Date(request.readyBy).toLocaleString('en-IN')}
              </Text>
            </View>
          </View>
        ) : (
          <TouchableOpacity disabled={isLoading} onPress={() => create()} style={styles.button}>
            <Icon name="download" size={16} color={COLORS.white} />
            <Text style={styles.buttonText}>
              {isLoading ? 'Submitting...' : 'Request Data Export'}
            </Text>
          </TouchableOpacity>
        )}
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
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.m, paddingVertical: SPACING.s },
  rowText: { fontSize: 13.5, color: COLORS.textPrimary },
  note: { fontSize: 12, color: COLORS.textTertiary, lineHeight: 18, marginVertical: SPACING.xl },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.s,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.s,
    padding: SPACING.m,
  },
  buttonText: { color: COLORS.white, fontWeight: '700' },
  status: {
    flexDirection: 'row',
    gap: SPACING.m,
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.m,
    padding: SPACING.l,
  },
  grow: { flex: 1 },
  statusTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  statusText: { fontSize: 11.5, color: COLORS.textSecondary, lineHeight: 17, marginTop: 4 },
});
export default DownloadDataScreen;
