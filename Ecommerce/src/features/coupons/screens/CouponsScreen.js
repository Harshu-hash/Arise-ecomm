import React, { useState } from 'react';
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
import { haptics } from '../../../utils/haptics';
import { useGetAvailableCouponsQuery } from '../api/coupons.api';

const CouponsScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [copiedId, setCopiedId] = useState(null);
  const { data, isLoading, error, refetch } = useGetAvailableCouponsQuery();

  if (isLoading) return <FullScreenLoader message="Loading coupons..." />;
  if (error && !data) return <ErrorState message={error.message} onRetry={refetch} />;

  const coupons = data?.items || [];
  const copy = coupon => {
    setCopiedId(coupon.id);
    haptics.success();
    toast.show(`${coupon.code} ready to use`, { icon: 'check', variant: 'success' });
  };

  return (
    <View style={styles.container}>
      <StatusBarManager barStyle="dark-content" themeColor={COLORS.surface} />
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity onPress={() => navigation?.goBack()} style={styles.iconButton}>
          <Icon name="arrow-left" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Available Coupons</Text>
        <View style={styles.iconButton} />
      </View>
      {!coupons.length ? (
        <EmptyState icon="tag" title="No coupons available" message="New offers will appear here." />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {coupons.map(coupon => (
            <View key={coupon.id} style={styles.card}>
              <View style={styles.copyRow}>
                <View style={styles.textBox}>
                  <Text style={styles.cardTitle}>{coupon.title}</Text>
                  <Text style={styles.subtitle}>{coupon.subtitle}</Text>
                  <Text style={styles.expiry}>{coupon.expiry}</Text>
                </View>
                <TouchableOpacity style={styles.copyButton} onPress={() => copy(coupon)}>
                  <Text style={styles.copyText}>{copiedId === coupon.id ? 'Copied' : coupon.code}</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.policy}>
                Final eligibility and savings are calculated by the cart service.
              </Text>
            </View>
          ))}
        </ScrollView>
      )}
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
  iconButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  content: { padding: SPACING.l },
  card: {
    padding: SPACING.l,
    marginBottom: SPACING.m,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.m,
  },
  copyRow: { flexDirection: 'row', alignItems: 'center' },
  textBox: { flex: 1, marginRight: SPACING.m },
  cardTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  subtitle: { marginTop: SPACING.xs, color: COLORS.textSecondary, fontSize: 12 },
  expiry: { marginTop: SPACING.s, color: COLORS.textTertiary, fontSize: 11 },
  copyButton: { padding: SPACING.s, borderRadius: RADIUS.s, backgroundColor: COLORS.primaryLight },
  copyText: { color: COLORS.primary, fontWeight: '700', fontSize: 12 },
  policy: { marginTop: SPACING.m, color: COLORS.textTertiary, fontSize: 11 },
});

export default CouponsScreen;
