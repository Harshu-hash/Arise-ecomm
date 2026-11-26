import React, { useState } from 'react';
import { ActivityIndicator, View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../../constants/colors';
import { SPACING, RADIUS } from '../../../constants/spacing';
import { StatusBarManager } from '../../../shared/components';
import { useToast } from '../../../contexts/ToastContext';
import { useGetSellerLeadQuery, useSubmitSellerLeadMutation } from '@features/seller';

const SellerRegistrationScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [gstin, setGstin] = useState('');
  const [mobile, setMobile] = useState('');
  const [pickupPincode, setPickupPincode] = useState('');
  const toast = useToast();
  const {
    data: existingInquiry,
    isLoading: isCheckingInquiry,
    isError: inquiryCheckFailed,
    refetch: checkInquiryAgain,
  } = useGetSellerLeadQuery();
  const [submitSellerLead, { isLoading }] = useSubmitSellerLeadMutation();

  const isComplete = [businessName, email, gstin, mobile, pickupPincode].every(value => value.trim());
  const validationMessage =
    businessName.trim().length < 2
      ? 'Business name must have at least 2 characters.'
      : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
        ? 'Enter a valid email address.'
        : !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z0-9]Z[A-Z0-9]$/.test(gstin.trim())
          ? 'Enter a valid 15-character GSTIN.'
          : !/^\+?[1-9][0-9]{9,14}$/.test(mobile.trim())
            ? 'Enter a valid mobile number.'
            : !/^[1-9][0-9]{5}$/.test(pickupPincode.trim())
              ? 'Enter a valid 6-digit pickup pincode.'
              : null;

  const submit = async () => {
    if (validationMessage) {
      toast.show(validationMessage, { variant: 'error' });
      return;
    }
    try {
      await submitSellerLead({
        businessName: businessName.trim(),
        email: email.trim().toLowerCase(),
        gstin: gstin.trim(),
        mobile: mobile.trim(),
        pickupPincode: pickupPincode.trim(),
        consentVersion: 'seller-lead-v1',
        idempotencyKey: `seller-lead-${Date.now()}-${mobile.trim()}`,
      }).unwrap();
      toast.show('Your seller application has been received.', { variant: 'success' });
      navigation?.goBack();
    } catch (error) {
      toast.show(error.message || 'Could not submit your application.', { variant: 'error' });
    }
  };

  return (
    <View style={styles.container}>
      <StatusBarManager barStyle="dark-content" themeColor={COLORS.surface} />

      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity onPress={() => navigation && navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Seller Registration</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {isCheckingInquiry ? (
          <ActivityIndicator color={COLORS.primary} style={styles.statusLoader} />
        ) : inquiryCheckFailed ? (
          <View style={styles.statusCard}>
            <Icon name="alert-circle" size={28} color={COLORS.error} />
            <Text style={styles.statusTitle}>Could not check your application</Text>
            <Text style={styles.statusText}>Please retry before submitting another seller inquiry.</Text>
            <TouchableOpacity onPress={checkInquiryAgain} style={styles.retryBtn}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : existingInquiry ? (
          <View style={styles.statusCard}>
            <Icon name="check-circle" size={32} color={COLORS.success} />
            <Text style={styles.statusTitle}>Application already submitted</Text>
            <Text style={styles.statusText}>
              We have your seller inquiry. Our team will contact you on the mobile number you provided.
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.introText}>
              Tell us a bit about your business to get started. It takes less than 5 minutes.
            </Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Business Name</Text>
              <TextInput
                style={styles.input}
                value={businessName}
                onChangeText={setBusinessName}
                placeholder="Enter your business / shop name"
                placeholderTextColor={COLORS.textTertiary}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Email Address</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                placeholder="Enter your email address"
                placeholderTextColor={COLORS.textTertiary}
              />
              {email.length > 0 && validationMessage === 'Enter a valid email address.' && (
                <Text style={styles.errorText}>{validationMessage}</Text>
              )}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>GSTIN</Text>
              <TextInput
                style={styles.input}
                value={gstin}
                onChangeText={value => setGstin(value.toUpperCase().replace(/\s/g, ''))}
                autoCapitalize="characters"
                autoCorrect={false}
                placeholder="15-character GSTIN"
                placeholderTextColor={COLORS.textTertiary}
              />
              {gstin.length > 0 && validationMessage === 'Enter a valid 15-character GSTIN.' && (
                <Text style={styles.errorText}>{validationMessage}</Text>
              )}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Mobile Number</Text>
              <TextInput
                style={styles.input}
                value={mobile}
                onChangeText={setMobile}
                keyboardType="phone-pad"
                placeholder="Enter your mobile number"
                placeholderTextColor={COLORS.textTertiary}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Pickup Pincode</Text>
              <TextInput
                style={styles.input}
                value={pickupPincode}
                onChangeText={setPickupPincode}
                keyboardType="number-pad"
                placeholder="Where should we pick up your orders from?"
                placeholderTextColor={COLORS.textTertiary}
              />
            </View>

            <View style={styles.infoNote}>
              <Icon name="info" size={14} color={COLORS.textTertiary} />
              <Text style={styles.infoNoteText}>
                You'll need your GST certificate and a cancelled cheque to complete verification.
              </Text>
            </View>
          </>
        )}
      </ScrollView>

      {!isCheckingInquiry && !inquiryCheckFailed && !existingInquiry && (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, SPACING.l) }]}>
          <TouchableOpacity
            activeOpacity={0.85}
            disabled={!isComplete || isLoading}
            style={[styles.submitBtn, (!isComplete || isLoading) && styles.submitBtnDisabled]}
            onPress={submit}>
            <Text style={styles.submitBtnText}>{isLoading ? 'Submitting...' : 'Submit Application'}</Text>
          </TouchableOpacity>
        </View>
      )}
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
  introText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 19,
    marginBottom: SPACING.xl,
  },
  statusLoader: { marginTop: SPACING.xxxl },
  statusCard: {
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.m,
    padding: SPACING.xl,
    marginTop: SPACING.xl,
  },
  statusTitle: {
    color: COLORS.textPrimary,
    fontSize: 17,
    fontWeight: '700',
    marginTop: SPACING.m,
  },
  statusText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    marginTop: SPACING.s,
    textAlign: 'center',
  },
  retryBtn: { marginTop: SPACING.l, padding: SPACING.m },
  retryText: { color: COLORS.primary, fontSize: 14, fontWeight: '700' },
  fieldGroup: {
    marginBottom: SPACING.l,
  },
  fieldLabel: {
    fontSize: 12.5,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.s,
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.m,
    fontSize: 14.5,
    color: COLORS.textPrimary,
  },
  errorText: {
    marginTop: SPACING.xs,
    color: COLORS.error,
    fontSize: 12,
  },
  infoNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: SPACING.s,
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
  submitBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.s,
    paddingVertical: SPACING.m,
    alignItems: 'center',
  },
  submitBtnText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '700',
  },
  submitBtnDisabled: { opacity: 0.45 },
});

export default SellerRegistrationScreen;
