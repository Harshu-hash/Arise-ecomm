import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../../constants/colors';
import { RADIUS, SPACING } from '../../../constants/spacing';
import { StatusBarManager } from '../../../shared/components';
import FullScreenLoader from '../../../shared/loaders/FullScreenLoader';
import ErrorState from '../../../shared/ErrorState/ErrorState';
import EmptyState from '../../../shared/EmptyState/EmptyState';
import { useToast } from '../../../contexts/ToastContext';
import {
  useDeletePaymentMethodMutation,
  useGetPaymentMethodsQuery,
} from '../api/payment.api';

const SavedCardsScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { data, isLoading, error, refetch } = useGetPaymentMethodsQuery();
  const [deleteMethod, { isLoading: isDeleting }] = useDeletePaymentMethodMutation();

  if (isLoading) return <FullScreenLoader message="Loading payment methods..." />;
  if (error && !data) return <ErrorState message={error.message} onRetry={refetch} />;

  const remove = async id => {
    try {
      await deleteMethod(id).unwrap();
      toast.show('Payment method removed.', { variant: 'success', icon: 'check' });
    } catch (requestError) {
      toast.show(requestError.message || 'Could not remove the payment method.');
    }
  };
  const methods = data?.items || [];

  return (
    <View style={styles.container}>
      <StatusBarManager barStyle="dark-content" themeColor={COLORS.surface} />
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity onPress={() => navigation?.goBack()} style={styles.back}>
          <Icon name="arrow-left" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Saved Payment Methods</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {!methods.length ? (
          <EmptyState
            icon="credit-card"
            title="No saved payment methods"
            message="Cards are tokenized and stored by the payment provider, never by Arise."
          />
        ) : (
          methods.map(method => (
            <View key={method.id} style={styles.card}>
              <View style={styles.row}>
                <Icon name="credit-card" size={22} color={COLORS.primary} />
                <View style={styles.details}>
                  <Text style={styles.label}>{method.label}</Text>
                  <Text style={styles.meta}>
                    {method.expiryMonth && method.expiryYear
                      ? `Expires ${String(method.expiryMonth).padStart(2, '0')}/${String(method.expiryYear).slice(-2)}`
                      : 'Provider-managed method'}
                  </Text>
                </View>
                {method.isDefault ? <Text style={styles.defaultText}>Default</Text> : null}
              </View>
              <TouchableOpacity disabled={isDeleting} onPress={() => remove(method.id)}>
                <Text style={styles.remove}>Remove</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
        <TouchableOpacity style={styles.action} onPress={() => navigation?.navigate('AddCard')}>
          <Icon name="plus" size={17} color={COLORS.primary} />
          <Text style={styles.actionText}>Add card securely</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.action} onPress={() => navigation?.navigate('AddGiftCard')}>
          <Icon name="gift" size={17} color={COLORS.primary} />
          <Text style={styles.actionText}>Redeem gift card</Text>
        </TouchableOpacity>
        <Text style={styles.securityNote}>
          Arise stores only an opaque provider token, card brand, last four digits and expiry.
        </Text>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.l,
    paddingBottom: SPACING.m,
    backgroundColor: COLORS.surface,
  },
  back: { marginRight: SPACING.m },
  headerTitle: { fontSize: 18, fontWeight: '600', color: COLORS.textPrimary },
  content: { padding: SPACING.l },
  card: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.m,
    padding: SPACING.l,
    marginBottom: SPACING.m,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  details: { flex: 1, marginLeft: SPACING.m },
  label: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '700' },
  meta: { color: COLORS.textSecondary, fontSize: 12, marginTop: SPACING.xs },
  defaultText: { color: COLORS.ratingGreen, fontSize: 11, fontWeight: '700' },
  remove: { color: COLORS.error, fontWeight: '700', marginTop: SPACING.m },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.s,
    paddingVertical: SPACING.m,
  },
  actionText: { color: COLORS.primary, fontWeight: '700' },
  securityNote: { color: COLORS.textTertiary, fontSize: 12, lineHeight: 18, marginTop: SPACING.l },
});

export default SavedCardsScreen;
