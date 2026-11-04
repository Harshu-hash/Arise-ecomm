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
import { useResetPasswordMutation } from '../api/auth.query';

const ResetPasswordScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetPassword, { isLoading, error }] = useResetPasswordMutation();
  const resetToken = route?.params?.resetToken;
  const returnTo = route?.params?.returnTo;

  const mismatch = confirmPassword.length > 0 && password !== confirmPassword;
  const canSubmit = Boolean(resetToken) && password.length >= 8 && password === confirmPassword;

  const handleBack = () => {
    if (navigation && navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation && navigation.navigate('Login');
    }
  };

  const handleReset = async () => {
    if (!canSubmit) return;
    try {
      await resetPassword({ resetToken, password }).unwrap();
      navigation?.reset({ index: 0, routes: [{ name: 'Login', params: { returnTo } }] });
    } catch {
      // RTK Query exposes the normalized error below the fields.
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
        <Text style={styles.title}>Set new password</Text>
        <Text style={styles.subtitle}>
          Your new password must be different from previously used passwords.
        </Text>

        <TextField
          label="New password"
          value={password}
          onChangeText={setPassword}
          placeholder="Enter new password"
          leftIcon="lock"
          secureToggle
          error={error?.fieldErrors?.password}
          style={styles.field}
        />

        <TextField
          label="Confirm password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder="Re-enter new password"
          leftIcon="lock"
          secureToggle
          error={mismatch ? 'Passwords do not match' : undefined}
          style={styles.field}
        />

        <AppButton
          title="Reset Password"
          onPress={handleReset}
          loading={isLoading}
          disabled={!canSubmit}
          fullWidth
          size="lg"
          style={styles.cta}
        />

        {error && !error.fieldErrors?.password ? (
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
    marginTop: SPACING.xl,
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

export default ResetPasswordScreen;
