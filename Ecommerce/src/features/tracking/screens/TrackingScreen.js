import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../../constants/colors';
import { SPACING, RADIUS } from '../../../constants/spacing';
import { StatusBarManager } from '../../../shared/components';
import FullScreenLoader from '../../../shared/loaders/FullScreenLoader';
import ErrorState from '../../../shared/ErrorState/ErrorState';
import { useGetShipmentTrackingQuery } from '../api/tracking.query';

const TrackingScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const shipmentId = route?.params?.shipmentId || route?.params?.orderId;
  const { data, error, isLoading, isFetching, refetch } = useGetShipmentTrackingQuery(shipmentId, {
    skip: !shipmentId,
    pollingInterval: 30000,
    skipPollingIfUnfocused: true,
  });

  if (isLoading) return <FullScreenLoader message="Loading shipment status..." />;
  if (error || !data) {
    return (
      <ErrorState
        title="Tracking unavailable"
        message={error?.message || 'This tracking link is incomplete.'}
        onRetry={shipmentId ? refetch : undefined}
      />
    );
  }

  const delivered = data.status === 'DELIVERED';
  return (
    <View style={styles.container}>
      <StatusBarManager barStyle="dark-content" themeColor={COLORS.surface} />
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity onPress={() => navigation?.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>{data.orderId}</Text>
          <Text style={styles.headerSubtitle}>{data.statusLabel}</Text>
        </View>
        <TouchableOpacity
          onPress={() => navigation?.navigate('OrderIssue', { orderId: data.orderId })}
          style={styles.helpBtn}
        >
          <Icon name="help-circle" size={18} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={isFetching} onRefresh={refetch} colors={[COLORS.primary]} />
        }
      >
        <View style={[styles.etaCard, data.eta.delayed && styles.delayCard]}>
          <Icon
            name={delivered ? 'check-circle' : data.eta.delayed ? 'alert-triangle' : 'truck'}
            size={24}
            color={data.eta.delayed ? COLORS.error : COLORS.primary}
          />
          <View style={styles.flex}>
            <Text style={styles.etaLabel}>{data.eta.label}</Text>
            <Text style={styles.updatedText}>
              Updated {new Date(data.updatedAt).toLocaleString('en-IN')}
            </Text>
          </View>
        </View>

        {data.deliveryCode?.revealAllowed && data.deliveryCode.value ? (
          <View style={styles.codeCard}>
            <View>
              <Text style={styles.codeLabel}>DELIVERY CODE</Text>
              <Text style={styles.codeValue}>{data.deliveryCode.value}</Text>
            </View>
            <Text style={styles.codeHelp}>
              Share only at your doorstep after verifying the delivery.
            </Text>
          </View>
        ) : data.deliveryCode ? (
          <View style={styles.noticeCard}>
            <Icon name="lock" size={15} color={COLORS.textSecondary} />
            <Text style={styles.noticeText}>
              Delivery code {data.deliveryCode.masked} will be revealed when the shipment is out for
              delivery.
            </Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Courier</Text>
          <Text style={styles.primaryText}>{data.courier.name}</Text>
          <Text style={styles.secondaryText}>Tracking number: {data.courier.trackingNumber}</Text>
        </View>

        {data.deliveryAgent ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Delivery partner</Text>
            <Text style={styles.primaryText}>{data.deliveryAgent.displayName}</Text>
            {data.deliveryAgent.vehicleLabel ? (
              <Text style={styles.secondaryText}>{data.deliveryAgent.vehicleLabel}</Text>
            ) : null}
            {data.deliveryAgent.location ? (
              <Text style={styles.secondaryText}>
                Live location updated{' '}
                {new Date(data.deliveryAgent.location.updatedAt).toLocaleTimeString('en-IN')}
              </Text>
            ) : (
              <Text style={styles.secondaryText}>
                Live location is not provided by this courier.
              </Text>
            )}
          </View>
        ) : null}

        {data.attempts.length ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Delivery attempts</Text>
            {data.attempts.map(attempt => (
              <View key={attempt.attemptedAt} style={styles.attemptRow}>
                <Icon name="alert-circle" size={15} color={COLORS.error} />
                <View style={styles.flex}>
                  <Text style={styles.primaryText}>{attempt.outcome}</Text>
                  <Text style={styles.secondaryText}>{attempt.message}</Text>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Shipment journey</Text>
          {data.events.map((event, index) => (
            <View key={event.id} style={styles.eventRow}>
              <View style={styles.eventIndicator}>
                <View
                  style={[
                    styles.dot,
                    event.completed && styles.dotCompleted,
                    event.active && styles.dotActive,
                  ]}
                />
                {index < data.events.length - 1 ? (
                  <View style={[styles.line, event.completed && styles.lineCompleted]} />
                ) : null}
              </View>
              <View style={styles.flex}>
                <Text
                  style={[
                    styles.eventLabel,
                    (event.completed || event.active) && styles.eventLabelActive,
                  ]}
                >
                  {event.label}
                </Text>
                <Text style={styles.secondaryText}>{event.description}</Text>
                {event.occurredAt ? (
                  <Text style={styles.eventTime}>
                    {new Date(event.occurredAt).toLocaleString('en-IN')}
                  </Text>
                ) : null}
              </View>
            </View>
          ))}
        </View>
        <Text style={styles.pollingNote}>
          Status refreshes approximately every {data.pollingIntervalSeconds} seconds while this
          screen is open.
        </Text>
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
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: { padding: 4, marginRight: SPACING.m },
  headerText: { flex: 1 },
  headerTitle: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary },
  headerSubtitle: { fontSize: 12, color: COLORS.primary, marginTop: 2 },
  helpBtn: { padding: SPACING.s, backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.round },
  scrollContent: { padding: SPACING.l, paddingBottom: SPACING.xxxl },
  etaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.m,
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.l,
    padding: SPACING.l,
    marginBottom: SPACING.m,
  },
  delayCard: { backgroundColor: COLORS.offerRedLight },
  etaLabel: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary },
  updatedText: { fontSize: 11.5, color: COLORS.textSecondary, marginTop: 3 },
  codeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xl,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.l,
    padding: SPACING.l,
    marginBottom: SPACING.m,
  },
  codeLabel: { color: COLORS.white, fontSize: 9, fontWeight: '800' },
  codeValue: { color: COLORS.white, fontSize: 26, fontWeight: '900', letterSpacing: 4 },
  codeHelp: { flex: 1, color: COLORS.white, fontSize: 12, lineHeight: 17 },
  noticeCard: {
    flexDirection: 'row',
    gap: SPACING.s,
    backgroundColor: COLORS.mutedBg,
    padding: SPACING.m,
    borderRadius: RADIUS.m,
    marginBottom: SPACING.m,
  },
  noticeText: { flex: 1, color: COLORS.textSecondary, fontSize: 12, lineHeight: 17 },
  card: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.l,
    padding: SPACING.l,
    marginBottom: SPACING.m,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: SPACING.m,
  },
  primaryText: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary },
  secondaryText: { fontSize: 12, color: COLORS.textSecondary, lineHeight: 17, marginTop: 2 },
  attemptRow: { flexDirection: 'row', gap: SPACING.s, marginBottom: SPACING.s },
  eventRow: { flexDirection: 'row', minHeight: 60 },
  eventIndicator: { width: 24, alignItems: 'center', marginRight: SPACING.s },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  dotCompleted: { backgroundColor: COLORS.ratingGreen, borderColor: COLORS.ratingGreen },
  dotActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  line: { flex: 1, width: 2, backgroundColor: COLORS.border },
  lineCompleted: { backgroundColor: COLORS.ratingGreen },
  eventLabel: { fontSize: 13, color: COLORS.textSecondary },
  eventLabelActive: { color: COLORS.textPrimary, fontWeight: '700' },
  eventTime: { fontSize: 10.5, color: COLORS.textTertiary, marginTop: 2 },
  pollingNote: { fontSize: 11, color: COLORS.textTertiary, textAlign: 'center', lineHeight: 16 },
});

export default TrackingScreen;
