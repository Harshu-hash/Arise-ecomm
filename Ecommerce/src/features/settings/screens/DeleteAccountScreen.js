import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../../constants/colors';
import { SPACING, RADIUS } from '../../../constants/spacing';
import { StatusBarManager } from '../../../shared/components';
import FullScreenLoader from '../../../shared/loaders/FullScreenLoader';
import ErrorState from '../../../shared/ErrorState/ErrorState';
import {
  useCreateDeletionRequestMutation,
  useGetDeletionEligibilityQuery,
} from '@features/privacy';
import { useToast } from '../../../contexts/ToastContext';
const reasons = [
  ['ANOTHER_ACCOUNT', 'I have another account'],
  ['PRIVACY', 'Privacy concerns'],
  ['NOT_USING', 'Not using the app'],
  ['EXPERIENCE', 'Poor experience'],
  ['OTHER', 'Other'],
];
const DeleteAccountScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets(),
    toast = useToast(),
    query = useGetDeletionEligibilityQuery(),
    [create, { isLoading }] = useCreateDeletionRequestMutation(),
    [reason, setReason] = useState(null),
    [confirmed, setConfirmed] = useState(false);
  if (query.isLoading) return <FullScreenLoader message="Checking account eligibility..." />;
  if (query.error)
    return (
      <ErrorState
        title="Could not check deletion status"
        message={query.error.message}
        onRetry={query.refetch}
      />
    );
  const data = query.data;
  const submit = async () => {
    try {
      await create({ reasonCode: reason, acknowledged: confirmed }).unwrap();
      toast.show('Account deletion request scheduled', { variant: 'success', icon: 'check' });
    } catch (error) {
      toast.show(error.message || 'Could not request account deletion', { variant: 'error' });
    }
  };
  return (
    <View style={styles.container}>
      <StatusBarManager barStyle="dark-content" themeColor={COLORS.surface} />
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity onPress={navigation.goBack}>
          <Icon name="arrow-left" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Delete My Account</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.warning}>
          <Icon name="alert-triangle" size={20} color={COLORS.error} />
          <Text style={styles.warningText}>
            Deletion is permanent once completed. Some records may be retained where law, payments,
            disputes, or fraud prevention require it.
          </Text>
        </View>
        {data.existingRequest ? (
          <View style={styles.request}>
            <Text style={styles.requestTitle}>
              Deletion {data.existingRequest.status.toLowerCase()}
            </Text>
            <Text style={styles.requestText}>
              {data.existingRequest.scheduledDeletionAt
                ? `Scheduled for ${new Date(data.existingRequest.scheduledDeletionAt).toLocaleString('en-IN')}`
                : 'Your request is being reviewed.'}
            </Text>
          </View>
        ) : null}
        {data.blockers.length ? (
          <>
            <Text style={styles.section}>Deletion is currently unavailable</Text>
            {data.blockers.map(item => (
              <View key={item.code} style={styles.blocker}>
                <Icon name="lock" size={15} color={COLORS.warning} />
                <View style={styles.grow}>
                  <Text style={styles.blockerCode}>{item.code.replace(/_/g, ' ')}</Text>
                  <Text style={styles.blockerText}>{item.message}</Text>
                </View>
              </View>
            ))}
          </>
        ) : !data.existingRequest ? (
          <>
            <Text style={styles.section}>Why are you leaving?</Text>
            {reasons.map(([code, label]) => (
              <TouchableOpacity key={code} onPress={() => setReason(code)} style={styles.reason}>
                <Icon
                  name={reason === code ? 'check-circle' : 'circle'}
                  size={18}
                  color={reason === code ? COLORS.primary : COLORS.textTertiary}
                />
                <Text style={styles.reasonText}>{label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => setConfirmed(value => !value)} style={styles.confirm}>
              <Icon
                name={confirmed ? 'check-square' : 'square'}
                size={18}
                color={confirmed ? COLORS.error : COLORS.textTertiary}
              />
              <Text style={styles.confirmText}>
                I understand this request is permanent after the cooling-off period.
              </Text>
            </TouchableOpacity>
          </>
        ) : null}
      </ScrollView>
      {data.eligible && !data.existingRequest ? (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, SPACING.l) }]}>
          <TouchableOpacity
            disabled={!reason || !confirmed || isLoading}
            onPress={submit}
            style={[styles.button, (!reason || !confirmed || isLoading) && styles.disabled]}
          >
            <Text style={styles.buttonText}>
              {isLoading ? 'Submitting...' : 'Request Account Deletion'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}
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
  content: { padding: SPACING.l, paddingBottom: SPACING.xxxl },
  warning: {
    flexDirection: 'row',
    gap: SPACING.m,
    backgroundColor: COLORS.offerRedLight,
    borderRadius: RADIUS.m,
    padding: SPACING.l,
  },
  warningText: { flex: 1, fontSize: 12.5, color: COLORS.textPrimary, lineHeight: 18 },
  section: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: SPACING.xl,
    marginBottom: SPACING.m,
  },
  blocker: {
    flexDirection: 'row',
    gap: SPACING.m,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.s,
    padding: SPACING.m,
    marginBottom: SPACING.s,
  },
  grow: { flex: 1 },
  blockerCode: { fontSize: 12, fontWeight: '700', color: COLORS.textPrimary },
  blockerText: { fontSize: 12, color: COLORS.textSecondary, lineHeight: 17, marginTop: 3 },
  request: {
    backgroundColor: COLORS.primaryLight,
    padding: SPACING.l,
    borderRadius: RADIUS.m,
    marginTop: SPACING.l,
  },
  requestTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  requestText: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4 },
  reason: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.m,
    paddingVertical: SPACING.s,
  },
  reasonText: { fontSize: 13.5, color: COLORS.textPrimary },
  confirm: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.m,
    marginTop: SPACING.xl,
  },
  confirmText: { flex: 1, fontSize: 12.5, color: COLORS.textSecondary, lineHeight: 18 },
  footer: {
    padding: SPACING.l,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  button: {
    backgroundColor: COLORS.error,
    borderRadius: RADIUS.s,
    padding: SPACING.m,
    alignItems: 'center',
  },
  disabled: { backgroundColor: COLORS.border },
  buttonText: { color: COLORS.white, fontWeight: '700' },
});
export default DeleteAccountScreen;
