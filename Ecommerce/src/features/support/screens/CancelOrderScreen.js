import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../../constants/colors';
import { SPACING, RADIUS } from '../../../constants/spacing';
import { StatusBarManager } from '../../../shared/components';
import { CANCEL_REASONS } from '../constants/helpData';

const CancelOrderScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const order = route?.params?.order;
  const [reason, setReason] = useState(null);
  const [comment, setComment] = useState('');
  const [cancelled, setCancelled] = useState(false);

  if (cancelled) {
    return (
      <View style={styles.container}>
        <StatusBarManager barStyle="dark-content" themeColor={COLORS.surface} />
        <View style={styles.successWrap}>
          <View style={styles.successIconCircle}>
            <Icon name="check" size={32} color={COLORS.white} />
          </View>
          <Text style={styles.successTitle}>Order Cancelled</Text>
          <Text style={styles.successSubtitle}>
            Your order {order?.id} has been cancelled. If any amount was paid, it will be refunded to
            your original payment method within 5-7 business days.
          </Text>
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.primaryBtn}
            onPress={() => navigation && navigation.navigate('MainTabs', { screen: 'Home' })}>
            <Text style={styles.primaryBtnText}>Continue Shopping</Text>
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
        <Text style={styles.headerTitle}>Cancel Order</Text>
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

        <Text style={styles.sectionTitle}>Why are you cancelling?</Text>
        {CANCEL_REASONS.map((r) => (
          <TouchableOpacity key={r} activeOpacity={0.7} style={styles.reasonRow} onPress={() => setReason(r)}>
            <View style={[styles.radio, reason === r && styles.radioActive]}>
              {reason === r ? <View style={styles.radioDot} /> : null}
            </View>
            <Text style={styles.reasonText}>{r}</Text>
          </TouchableOpacity>
        ))}

        {reason === 'Other' ? (
          <TextInput
            style={styles.commentInput}
            value={comment}
            onChangeText={setComment}
            multiline
            placeholder="Tell us more..."
            placeholderTextColor={COLORS.textTertiary}
          />
        ) : null}

        <View style={styles.infoNote}>
          <Icon name="info" size={14} color={COLORS.textTertiary} />
          <Text style={styles.infoNoteText}>
            If already paid, your refund will be credited to the original payment method within 5-7
            business days.
          </Text>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, SPACING.l) }]}>
        <TouchableOpacity
          activeOpacity={0.85}
          disabled={!reason}
          style={[styles.confirmBtn, !reason && styles.confirmBtnDisabled]}
          onPress={() => setCancelled(true)}>
          <Text style={styles.confirmBtnText}>Confirm Cancellation</Text>
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
  commentInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.s,
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.m,
    fontSize: 13.5,
    color: COLORS.textPrimary,
    minHeight: 80,
    textAlignVertical: 'top',
    marginTop: SPACING.s,
  },
  infoNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: SPACING.xl,
    gap: SPACING.xs,
  },
  infoNoteText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.textTertiary,
    lineHeight: 16,
  },
  footer: {
    paddingHorizontal: SPACING.l,
    paddingTop: SPACING.m,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  confirmBtn: {
    backgroundColor: COLORS.error,
    borderRadius: RADIUS.s,
    paddingVertical: SPACING.m,
    alignItems: 'center',
  },
  confirmBtnDisabled: {
    backgroundColor: COLORS.border,
  },
  confirmBtnText: {
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

export default CancelOrderScreen;
