import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../../constants/colors';
import { SPACING } from '../../../constants/spacing';
import { StatusBarManager } from '../../../shared/components';
import AppButton from '../../../shared/buttons/AppButton';
import TextField from '../../../shared/inputs/TextField';
import { useStartAuthMutation } from '../api/auth.query';

const ForgotPasswordScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const [identifier, setIdentifier] = useState('');
  const [startAuth, { isLoading, error }] = useStartAuthMutation();
  const returnTo = route?.params?.returnTo;

  const handleBack = () => {
    if (navigation && navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation && navigation.navigate('Login');
    }
  };

  const handleSendOtp = async () => {
    if (!identifier.trim()) return;
    try {
      const challenge = await startAuth({
        identifier: identifier.trim(),
        purpose: 'PASSWORD_RESET',
      }).unwrap();
      navigation?.navigate('OtpVerification', {
        identifier: identifier.trim(),
        destinationMasked: challenge.destinationMasked,
        challengeId: challenge.challengeId,
        resendAvailableAt: challenge.resendAvailableAt,
        mode: 'reset',
        returnTo,
      });
    } catch {
      // RTK Query exposes the normalized error below the field.
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBarManager barStyle="dark-content" themeColor={COLORS.background} />

      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn} activeOpacity={0.7}>
          <Icon name="arrow-left" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>Forgot password?</Text>
        <Text style={styles.subtitle}>
          Enter your registered mobile number or email, we'll send you a code to reset it.
        </Text>

        <TextField
          label="Mobile number or Email"
          value={identifier}
          onChangeText={setIdentifier}
          placeholder="Enter mobile number or email"
          leftIcon="mail"
          autoCapitalize="none"
          error={error?.fieldErrors?.identifier}
          style={styles.field}
        />

        <AppButton
          title="Send OTP"
          onPress={handleSendOtp}
          loading={isLoading}
          disabled={!identifier.trim()}
          fullWidth
          size="lg"
          style={styles.cta}
        />

        {error && !error.fieldErrors?.identifier ? (
          <Text accessibilityRole="alert" style={styles.errorText}>
            {error.message}
          </Text>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingHorizontal: SPACING.l,
    paddingBottom: SPACING.s,
  },
  backBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: SPACING.l,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  subtitle: {
    fontSize: 13.5,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
    lineHeight: 19,
  },
  field: {
    marginTop: SPACING.xxl,
  },
  cta: {
    marginTop: SPACING.l,
  },
  errorText: {
    color: COLORS.error,
    fontSize: 12,
    marginTop: SPACING.s,
  },
});

export default ForgotPasswordScreen;
