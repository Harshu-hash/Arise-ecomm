import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../../constants/colors';
import { SPACING } from '../../../constants/spacing';
import { StatusBarManager } from '../../../shared/components';
import AppButton from '../../../shared/buttons/AppButton';
import TextField from '../../../shared/inputs/TextField';

const LoginScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendOtp = () => {
    if (!identifier.trim()) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      navigation && navigation.navigate('OtpVerification', { identifier: identifier.trim(), mode: 'login' });
    }, 600);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBarManager barStyle="dark-content" themeColor={COLORS.background} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingTop: Math.max(insets.top, 24) }]}
        keyboardShouldPersistTaps="handled">
        <View style={styles.logoCircle}>
          <Icon name="shopping-bag" size={28} color={COLORS.primary} />
        </View>

        <Text style={styles.title}>Login</Text>
        <Text style={styles.subtitle}>Get access to your orders, wishlist and recommendations.</Text>

        <TextField
          label="Mobile number or Email"
          value={identifier}
          onChangeText={setIdentifier}
          placeholder="Enter mobile number or email"
          leftIcon="user"
          autoCapitalize="none"
          style={styles.field}
        />

        <AppButton
          title="Continue"
          onPress={handleSendOtp}
          loading={loading}
          disabled={!identifier.trim()}
          fullWidth
          size="lg"
          style={styles.cta}
        />

        <Text style={styles.terms}>
          By continuing, you agree to Arise's Terms of Use and Privacy Policy.
        </Text>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => navigation && navigation.navigate('ForgotPassword')}
          style={styles.forgotRow}>
          <Text style={styles.signupLink}>Trouble logging in?</Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => navigation && navigation.navigate('Signup')}
          style={styles.signupRow}>
          <Text style={styles.signupText}>
            New to Arise? <Text style={styles.signupLink}>Create an account</Text>
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
  scrollContent: {
    paddingHorizontal: SPACING.l,
    paddingBottom: SPACING.xxl,
  },
  logoCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.l,
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
  forgotRow: {
    alignSelf: 'flex-start',
    marginTop: SPACING.l,
  },
  terms: {
    fontSize: 11.5,
    color: COLORS.textTertiary,
    marginTop: SPACING.m,
    lineHeight: 16,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.xxl,
  },
  signupRow: {
    alignItems: 'center',
  },
  signupText: {
    fontSize: 13.5,
    color: COLORS.textSecondary,
  },
  signupLink: {
    color: COLORS.primary,
    fontWeight: '700',
  },
});

export default LoginScreen;
