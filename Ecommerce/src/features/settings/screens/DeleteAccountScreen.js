import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../../constants/colors';
import { SPACING, RADIUS } from '../../../constants/spacing';
import { StatusBarManager } from '../../../shared/components';

const REASONS = [
  'I have another account',
  'Privacy concerns',
  'Not using the app anymore',
  'Poor experience / bugs',
  'Other',
];

const DeleteAccountScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [reason, setReason] = useState(null);
  const [confirmed, setConfirmed] = useState(false);

  return (
    <View style={styles.container}>
      <StatusBarManager barStyle="dark-content" themeColor={COLORS.surface} />

      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity onPress={() => navigation && navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Delete My Account</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.warningBox}>
          <Icon name="alert-triangle" size={20} color={COLORS.error} />
          <Text style={styles.warningText}>
            This action is permanent. Deleting your account will remove your profile, order
            history, saved addresses, cards and reviews. This cannot be undone.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Why are you leaving?</Text>
        {REASONS.map((r) => (
          <TouchableOpacity
            key={r}
            activeOpacity={0.7}
            style={styles.reasonRow}
            onPress={() => setReason(r)}>
            <View style={[styles.radio, reason === r && styles.radioActive]}>
              {reason === r ? <View style={styles.radioDot} /> : null}
            </View>
            <Text style={styles.reasonText}>{r}</Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.confirmRow}
          onPress={() => setConfirmed((v) => !v)}>
          <View style={[styles.checkbox, confirmed && styles.checkboxActive]}>
            {confirmed ? <Icon name="check" size={12} color={COLORS.white} /> : null}
          </View>
          <Text style={styles.confirmText}>
            I understand this action is permanent and cannot be reversed.
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, SPACING.l) }]}>
        <TouchableOpacity
          activeOpacity={0.85}
          disabled={!reason || !confirmed}
          style={[styles.deleteBtn, (!reason || !confirmed) && styles.deleteBtnDisabled]}>
          <Text style={styles.deleteBtnText}>Delete My Account</Text>
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
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.offerRedLight,
    borderRadius: RADIUS.m,
    padding: SPACING.l,
    gap: SPACING.m,
    marginBottom: SPACING.xl,
  },
  warningText: {
    flex: 1,
    fontSize: 12.5,
    color: COLORS.textPrimary,
    lineHeight: 18,
  },
  sectionTitle: {
    fontSize: 14.5,
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
  confirmRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: SPACING.xl,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: RADIUS.xs,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.m,
    marginTop: 1,
  },
  checkboxActive: {
    backgroundColor: COLORS.error,
    borderColor: COLORS.error,
  },
  confirmText: {
    flex: 1,
    fontSize: 12.5,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  footer: {
    paddingHorizontal: SPACING.l,
    paddingTop: SPACING.m,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  deleteBtn: {
    backgroundColor: COLORS.error,
    borderRadius: RADIUS.s,
    paddingVertical: SPACING.m,
    alignItems: 'center',
  },
  deleteBtnDisabled: {
    backgroundColor: COLORS.border,
  },
  deleteBtnText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '700',
  },
});

export default DeleteAccountScreen;
