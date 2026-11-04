import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../../constants/colors';
import { SPACING } from '../../../constants/spacing';
import { StatusBarManager } from '../../../shared/components';
import AppButton from '../../../shared/buttons/AppButton';
import TextField from '../../../shared/inputs/TextField';
import { useStartAuthMutation } from '../api/auth.query';

const SignupScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [startAuth, { isLoading, error }] = useStartAuthMutation();
  const returnTo = route?.params?.returnTo;

  const canSubmit = name.trim() && identifier.trim();

  const handleBack = () => {
    if (navigation && navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation && navigation.navigate('Login');
    }
  };

  const handleCreateAccount = async () => {
    if (!canSubmit) return;
    try {
      const challenge = await startAuth({
        identifier: identifier.trim(),
        name: name.trim(),
        purpose: 'SIGNUP',
      }).unwrap();
      navigation?.navigate('OtpVerification', {
        identifier: identifier.trim(),
        destinationMasked: challenge.destinationMasked,
        challengeId: challenge.challengeId,
        resendAvailableAt: challenge.resendAvailableAt,
        mode: 'signup',
        returnTo,
      });
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

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Create account</Text>
        <Text style={styles.subtitle}>Join Arise for faster checkout and exclusive deals.</Text>

        <TextField
          label="Full name"
          value={name}
          onChangeText={setName}
          placeholder="Enter your name"
          leftIcon="user"
          error={error?.fieldErrors?.name}
          style={styles.field}
        />

        <TextField
          label="Mobile number or Email"
          value={identifier}
          onChangeText={setIdentifier}
          placeholder="Enter mobile number or email"
          leftIcon="smartphone"
          autoCapitalize="none"
          error={error?.fieldErrors?.identifier}
          style={styles.field}
        />

        <AppButton
          title="Create Account"
          onPress={handleCreateAccount}
          loading={isLoading}
          disabled={!canSubmit}
          fullWidth
          size="lg"
          style={styles.cta}
        />

        {error && !error.fieldErrors?.name && !error.fieldErrors?.identifier ? (
          <Text accessibilityRole="alert" style={styles.errorText}>
            {error.message}
          </Text>
        ) : null}

        <View style={styles.divider} />

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => navigation?.navigate('Login', { returnTo })}
          style={styles.loginRow}
        >
          <Text style={styles.loginText}>
            Already have an account? <Text style={styles.loginLink}>Log in</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
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
  scrollContent: {
    paddingHorizontal: SPACING.l,
    paddingBottom: SPACING.xxl,
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
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.xxl,
  },
  loginRow: {
    alignItems: 'center',
  },
  loginText: {
    fontSize: 13.5,
    color: COLORS.textSecondary,
  },
  loginLink: {
    color: COLORS.primary,
    fontWeight: '700',
  },
});

export default SignupScreen;
