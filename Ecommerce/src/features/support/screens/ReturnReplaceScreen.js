import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../../constants/colors';
import { SPACING, RADIUS } from '../../../constants/spacing';
import { StatusBarManager } from '../../../shared/components';
import { RETURN_REASONS } from '../constants/helpData';

const MODES = [
  { id: 'refund', label: 'Return for Refund' },
  { id: 'replace', label: 'Replacement' },
];

const ReturnReplaceScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const order = route?.params?.order;
  const [mode, setMode] = useState('refund');
  const [reason, setReason] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <View style={styles.container}>
        <StatusBarManager barStyle="dark-content" themeColor={COLORS.surface} />
        <View style={styles.successWrap}>
          <View style={styles.successIconCircle}>
            <Icon name="check" size={32} color={COLORS.white} />
          </View>
          <Text style={styles.successTitle}>
            {mode === 'refund' ? 'Return Request Placed' : 'Replacement Requested'}
          </Text>
          <Text style={styles.successSubtitle}>
            Our delivery partner will pick up the item from your saved address within 2-3 business
            days. {mode === 'refund'
              ? 'Your refund will be initiated once the item passes quality check.'
              : 'A replacement will be shipped once the returned item is picked up.'}
          </Text>
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.primaryBtn}
            onPress={() => navigation && navigation.navigate('MyTickets')}>
            <Text style={styles.primaryBtnText}>Track this Request</Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.secondaryBtn}
            onPress={() => navigation && navigation.navigate('HelpCenter')}>
            <Text style={styles.secondaryBtnText}>Back to Help Center</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBarManager barStyle="dark-content" themeColor={COLORS.surface} />

      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity onPress={() => navigation && navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Return / Replace</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {order ? (
          <View style={styles.orderCard}>
            <Image source={{ uri: order.image }} style={styles.image} resizeMode="cover" />
            <View style={{ flex: 1 }}>
              <Text style={styles.orderName} numberOfLines={2}>{order.name}</Text>
              <Text style={styles.orderMeta}>{order.id} · ₹{order.price}</Text>
            </View>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>What would you like?</Text>
        <View style={styles.modeRow}>
          {MODES.map((m) => (
            <TouchableOpacity
              key={m.id}
              activeOpacity={0.8}
              onPress={() => setMode(m.id)}
              style={[styles.modeChip, mode === m.id && styles.modeChipActive]}>
              <Text style={[styles.modeChipText, mode === m.id && styles.modeChipTextActive]}>{m.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Select a reason</Text>
        {RETURN_REASONS.map((r) => (
          <TouchableOpacity key={r} activeOpacity={0.7} style={styles.reasonRow} onPress={() => setReason(r)}>
            <View style={[styles.radio, reason === r && styles.radioActive]}>
              {reason === r ? <View style={styles.radioDot} /> : null}
            </View>
            <Text style={styles.reasonText}>{r}</Text>
          </TouchableOpacity>
        ))}

        <Text style={styles.sectionTitle}>Pickup Address</Text>
        <View style={styles.addressCard}>
          <Icon name="map-pin" size={16} color={COLORS.primary} style={{ marginTop: 2 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.addressName}>Home</Text>
            <Text style={styles.addressText}>
              221B Baker Street, Sector 12, Near City Mall, Ahmedabad, Gujarat - 380015
            </Text>
          </View>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => navigation && navigation.navigate('SavedAddresses')}>
            <Text style={styles.changeText}>Change</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, SPACING.l) }]}>
        <TouchableOpacity
          activeOpacity={0.85}
          disabled={!reason}
          style={[styles.submitBtn, !reason && styles.submitBtnDisabled]}
          onPress={() => setSubmitted(true)}>
          <Text style={styles.submitBtnText}>
            {mode === 'refund' ? 'Schedule Return Pickup' : 'Request Replacement'}
          </Text>
        </TouchableOpacity>
      </View>
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
  orderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.mutedBg,
    borderRadius: RADIUS.m,
    padding: SPACING.m,
    gap: SPACING.m,
    marginBottom: SPACING.xl,
  },
  image: {
    width: 50,
    height: 50,
    borderRadius: RADIUS.s,
    backgroundColor: COLORS.white,
  },
  orderName: {
    fontSize: 12.5,
    fontWeight: '600',
    color: COLORS.textPrimary,
    lineHeight: 16,
    marginBottom: 3,
  },
  orderMeta: {
    fontSize: 11,
    color: COLORS.textTertiary,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.m,
    marginTop: SPACING.s,
  },
  modeRow: {
    flexDirection: 'row',
    gap: SPACING.s,
    marginBottom: SPACING.l,
  },
  modeChip: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.s,
    paddingVertical: SPACING.m,
  },
  modeChipActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  modeChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  modeChipTextActive: {
    color: COLORS.primary,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.s,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.m,
  },
  radioActive: {
    borderColor: COLORS.primary,
  },
  radioDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: COLORS.primary,
  },
  reasonText: {
    fontSize: 13.5,
    color: COLORS.textPrimary,
  },
  addressCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.m,
    padding: SPACING.m,
    gap: SPACING.m,
  },
  addressName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  addressText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 17,
  },
  changeText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: COLORS.primary,
  },
  footer: {
    paddingHorizontal: SPACING.l,
    paddingTop: SPACING.m,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  submitBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.s,
    paddingVertical: SPACING.m,
    alignItems: 'center',
  },
  submitBtnDisabled: {
    backgroundColor: COLORS.border,
  },
  submitBtnText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '700',
  },
  successWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
  },
  successIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.l,
  },
  successTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.s,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: SPACING.xxl,
  },
  primaryBtn: {
    alignSelf: 'stretch',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.s,
    paddingVertical: SPACING.m,
    alignItems: 'center',
    marginBottom: SPACING.m,
  },
  primaryBtnText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryBtn: {
    paddingVertical: SPACING.s,
  },
  secondaryBtnText: {
    color: COLORS.primary,
    fontSize: 13.5,
    fontWeight: '600',
  },
});

export default ReturnReplaceScreen;
