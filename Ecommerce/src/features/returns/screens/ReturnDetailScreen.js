import React from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../../constants/colors';
import { SPACING, RADIUS } from '../../../constants/spacing';
import { StatusBarManager } from '../../../shared/components';
import FullScreenLoader from '../../../shared/loaders/FullScreenLoader';
import ErrorState from '../../../shared/ErrorState/ErrorState';
import { useCancelReturnMutation, useGetReturnQuery } from '../api/returns.query';

// Where a customer follows a return: what has happened so far, who is collecting it, what the refund is doing, and
// (until the courier has the item) a way to withdraw it. Everything shown comes from the server.

const BAD = ['REJECTED', 'QC_FAILED', 'CANCELLED'];
const REFUND_TEXT = {
  PENDING: 'Waiting to be processed',
  PROCESSING: 'On its way to your original payment method',
  SUCCEEDED: 'Refunded to your original payment method',
  FAILED: 'Could not be sent yet. We are retrying; contact support if it takes long',
};

const DOT_STYLE = {}; // filled in below, once the styles exist

const when = iso =>
  new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

const ReturnDetailScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const returnId = route?.params?.returnId;
  const { data, error, isLoading, refetch } = useGetReturnQuery(returnId, { skip: !returnId });
  const [cancelReturn, { isLoading: isCancelling }] = useCancelReturnMutation();

  if (isLoading) return <FullScreenLoader message="Loading your return..." />;
  if (error || !data) {
    return <ErrorState title="Return unavailable" message={error?.message} onRetry={refetch} />;
  }

  const history = data.timeline?.length ? data.timeline : [{ status: data.status, label: data.status, at: data.createdAt }];
  const current = history[history.length - 1];
  // every step up to the refund, with what is still to come (older servers send only the history)
  const steps = data.journey?.length
    ? data.journey
    : history.map((step, index) => ({ ...step, state: index === history.length - 1 ? 'CURRENT' : 'DONE' }));
  const hasRefund = data.refund.status !== 'NOT_REQUIRED';

  const confirmCancel = () =>
    Alert.alert('Cancel this return?', 'The pickup will be cancelled and you keep the item.', [
      { text: 'Keep return', style: 'cancel' },
      {
        text: 'Cancel return',
        style: 'destructive',
        onPress: () =>
          cancelReturn(data.id)
            .unwrap()
            .catch(e => Alert.alert('Could not cancel', e.message || 'Please try again.')),
      },
    ]);

  return (
    <View style={styles.container}>
      <StatusBarManager barStyle="dark-content" themeColor={COLORS.surface} />
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity onPress={() => navigation && navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Return status</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.itemCard}>
          {data.imageUrl ? <Image source={{ uri: data.imageUrl }} style={styles.image} resizeMode="cover" /> : null}
          <View style={styles.flex}>
            <Text style={styles.itemName} numberOfLines={2}>
              {data.productName || 'Returned item'}
            </Text>
            <Text style={styles.meta}>
              {data.orderNumber ? `Order ${data.orderNumber} · ` : ''}₹{data.refund.amount}
            </Text>
          </View>
        </View>

        <View style={[styles.banner, BAD.includes(current.status) && styles.bannerBad]}>
          <Text style={[styles.bannerText, BAD.includes(current.status) && styles.bannerTextBad]}>{current.label}</Text>
          {data.outcomeNote ? <Text style={styles.note}>{data.outcomeNote}</Text> : null}
        </View>

        <Text style={styles.sectionTitle}>Progress</Text>
        <View style={styles.card}>
          {steps.map((step, index) => {
            const last = index === steps.length - 1;
            const { state } = step;
            return (
              <View key={step.status} style={styles.stepRow}>
                <View style={styles.railCol}>
                  <View style={[styles.dot, DOT_STYLE[state]]} />
                  {last ? null : <View style={[styles.rail, state === 'DONE' && styles.railDone]} />}
                </View>
                <View style={[styles.flex, !last && styles.stepGap]}>
                  <Text style={[styles.stepLabel, state === 'CURRENT' && styles.stepLabelActive, state === 'FAILED' && styles.stepLabelBad]}>
                    {step.label}
                  </Text>
                  {step.at ? <Text style={styles.stepTime}>{when(step.at)}</Text> : null}
                </View>
              </View>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>Pickup</Text>
        <View style={styles.card}>
          <Text style={styles.line}>{data.pickupWindowLabel}</Text>
          {data.courier ? (
            <Text style={styles.metaLine}>
              {data.courier.name || 'Courier'} · Tracking {data.courier.awb}
            </Text>
          ) : null}
        </View>

        {hasRefund ? (
          <>
            <Text style={styles.sectionTitle}>Refund</Text>
            <View style={styles.card}>
              <Text style={styles.line}>₹{data.refund.amount}</Text>
              <Text style={styles.metaLine}>{REFUND_TEXT[data.refund.status]}</Text>
            </View>
          </>
        ) : null}

        {data.canCancel ? (
          <TouchableOpacity
            activeOpacity={0.85}
            disabled={isCancelling}
            style={[styles.cancelBtn, isCancelling && styles.disabled]}
            onPress={confirmCancel}
          >
            <Text style={styles.cancelText}>{isCancelling ? 'Cancelling...' : 'Cancel return'}</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.l,
    paddingBottom: SPACING.m,
  },
  backBtn: { marginRight: SPACING.m },
  headerTitle: { fontSize: 19, fontWeight: '500', color: COLORS.textPrimary },
  scrollContent: { paddingHorizontal: SPACING.l, paddingTop: SPACING.l, paddingBottom: SPACING.xxxl },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.mutedBg,
    borderRadius: RADIUS.m,
    padding: SPACING.m,
    gap: SPACING.m,
    marginBottom: SPACING.l,
  },
  image: { width: 56, height: 56, borderRadius: RADIUS.s, backgroundColor: COLORS.white },
  itemName: { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary, lineHeight: 17, marginBottom: 3 },
  meta: { fontSize: 12, color: COLORS.textSecondary },
  banner: { backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.m, padding: SPACING.m, marginBottom: SPACING.l },
  bannerBad: { backgroundColor: COLORS.offerRedLight },
  bannerText: { fontSize: 15, fontWeight: '700', color: COLORS.primaryDark },
  bannerTextBad: { color: COLORS.offerRed },
  note: { marginTop: SPACING.xs, fontSize: 13, color: COLORS.textPrimary, lineHeight: 18 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.s },
  card: {
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: RADIUS.m,
    padding: SPACING.m,
    marginBottom: SPACING.l,
  },
  stepRow: { flexDirection: 'row' },
  railCol: { width: 22, alignItems: 'center' },
  dot: { width: 12, height: 12, borderRadius: RADIUS.round, marginTop: 3 },
  dotDone: { backgroundColor: COLORS.success },
  dotCurrent: { backgroundColor: COLORS.success, borderWidth: 3, borderColor: COLORS.ratingGreenBg, width: 16, height: 16, marginTop: 1 },
  dotPending: { backgroundColor: COLORS.white, borderWidth: 2, borderColor: COLORS.border },
  dotBad: { backgroundColor: COLORS.offerRed },
  rail: { flex: 1, width: 2, backgroundColor: COLORS.border, marginTop: 2 },
  railDone: { backgroundColor: COLORS.success },
  stepGap: { paddingBottom: SPACING.m },
  stepLabel: { fontSize: 13, color: COLORS.textSecondary },
  stepLabelActive: { color: COLORS.textPrimary, fontWeight: '700' },
  stepLabelBad: { color: COLORS.offerRed, fontWeight: '700' },
  stepTime: { fontSize: 11.5, color: COLORS.textTertiary, marginTop: 2 },
  line: { fontSize: 13.5, color: COLORS.textPrimary, lineHeight: 19 },
  metaLine: { fontSize: 12.5, color: COLORS.textSecondary, marginTop: SPACING.xs },
  cancelBtn: {
    alignSelf: 'stretch',
    borderWidth: 1,
    borderColor: COLORS.error,
    borderRadius: RADIUS.s,
    paddingVertical: SPACING.m,
    alignItems: 'center',
  },
  cancelText: { color: COLORS.error, fontSize: 15, fontWeight: '700' },
  disabled: { opacity: 0.5 },
});

Object.assign(DOT_STYLE, {
  DONE: styles.dotDone,
  CURRENT: styles.dotCurrent,
  PENDING: styles.dotPending,
  FAILED: styles.dotBad,
});

export default ReturnDetailScreen;
