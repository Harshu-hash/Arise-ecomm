import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { COLORS } from '../../../constants/colors';
import { SPACING, RADIUS } from '../../../constants/spacing';
import { StatusBarManager } from '../../../shared/components';
import AppButton from '../../../shared/buttons/AppButton';
import { haptics } from '../../../utils/haptics';
import {
  useResendOtpMutation,
  useVerifyOtpMutation,
  useVerifyPasswordResetOtpMutation,
} from '../api/auth.query';
import { buildCustomerRootState } from '../../../navigation/navigationState';

const OTP_LENGTH = 4;
const RESEND_SECONDS = 30;
const secondsUntil = value => {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return RESEND_SECONDS;
  return Math.max(0, Math.ceil((timestamp - Date.now()) / 1000));
};

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

const OtpDigitBox = ({ digit, inputRef, ...inputProps }) => {
  const scale = useSharedValue(1);

  useEffect(() => {
    if (digit) {
      scale.value = withSpring(1.12, { damping: 10, stiffness: 220 }, () => {
        scale.value = withSpring(1, { damping: 14, stiffness: 220 });
      });
    }
  }, [digit, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedTextInput
      ref={inputRef}
      value={digit}
      keyboardType="number-pad"
      maxLength={1}
      style={[styles.otpBox, digit ? styles.otpBoxFilled : null, animatedStyle]}
      {...inputProps}
    />
  );
};

const OtpVerificationScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const params = route?.params || {};
  const { identifier = '', destinationMasked = '', mode = 'login', returnTo } = params;

  const [digits, setDigits] = useState(Array(OTP_LENGTH).fill(''));
  const [challengeId, setChallengeId] = useState(params.challengeId);
  const [destination, setDestination] = useState(destinationMasked);
  const [secondsLeft, setSecondsLeft] = useState(() => secondsUntil(params.resendAvailableAt));
  const inputRefs = useRef([]);
  const [verifyOtp, { isLoading, error: verifyError }] = useVerifyOtpMutation();
  const [verifyPasswordResetOtp, { isLoading: isVerifyingReset, error: resetVerifyError }] =
    useVerifyPasswordResetOtpMutation();
  const [resendOtp, { isLoading: isResending, error: resendError }] = useResendOtpMutation();

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft(s => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  const handleBack = () => {
    if (navigation && navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation && navigation.navigate('Login');
    }
  };

  const handleChangeDigit = (text, index) => {
    const clean = text.replace(/[^0-9]/g, '');
    if (clean.length > 1) {
      const pasted = clean.slice(0, OTP_LENGTH - index).split('');
      const next = [...digits];
      pasted.forEach((value, offset) => {
        next[index + offset] = value;
      });
      setDigits(next);
      haptics.selection();
      inputRefs.current[Math.min(index + pasted.length, OTP_LENGTH - 1)]?.focus();
      return;
    }
    const next = [...digits];
    next[index] = clean;
    setDigits(next);
    if (clean) {
      haptics.selection();
      if (index < OTP_LENGTH - 1) inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const otpValue = digits.join('');
  const canVerify = otpValue.length === OTP_LENGTH;

  const handleVerify = async () => {
    if (!canVerify) return;
    try {
      if (mode === 'reset') {
        const verification = await verifyPasswordResetOtp({ challengeId, otp: otpValue }).unwrap();
        haptics.success();
        navigation?.navigate('ResetPassword', {
          identifier,
          resetToken: verification.resetToken,
          resetTokenExpiresAt: verification.expiresAt,
          returnTo,
        });
        return;
      }
      await verifyOtp({ challengeId, otp: otpValue }).unwrap();
      haptics.success();
      navigation?.getParent()?.reset(buildCustomerRootState(returnTo));
    } catch {
      haptics.error();
    }
  };

  const handleResend = async () => {
    if (secondsLeft > 0) return;
    try {
      const challenge = await resendOtp({ challengeId }).unwrap();
      setChallengeId(challenge.challengeId);
      setDestination(challenge.destinationMasked);
      haptics.selection();
      setSecondsLeft(secondsUntil(challenge.resendAvailableAt));
      setDigits(Array(OTP_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    } catch {
      haptics.error();
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
        <Text style={styles.title}>Verify OTP</Text>
        <Text style={styles.subtitle}>
          Enter the {OTP_LENGTH}-digit code sent to{' '}
          <Text style={styles.identifier}>{destination || identifier || 'your number'}</Text>
        </Text>

        <View style={styles.otpRow}>
          {digits.map((digit, index) => (
            <OtpDigitBox
              key={index}
              digit={digit}
              inputRef={ref => {
                inputRefs.current[index] = ref;
              }}
              maxLength={index === 0 ? OTP_LENGTH : 1}
              textContentType={index === 0 ? 'oneTimeCode' : 'none'}
              autoComplete={index === 0 ? 'sms-otp' : 'off'}
              onChangeText={text => handleChangeDigit(text, index)}
              onKeyPress={e => handleKeyPress(e, index)}
            />
          ))}
        </View>

        <AppButton
          title="Verify"
          onPress={handleVerify}
          loading={isLoading || isVerifyingReset}
          disabled={!canVerify || !challengeId}
          fullWidth
          size="lg"
          style={styles.cta}
        />

        {verifyError || resetVerifyError || resendError ? (
          <Text accessibilityRole="alert" style={styles.errorText}>
            {(verifyError || resetVerifyError || resendError).message}
          </Text>
        ) : null}

        <TouchableOpacity
          activeOpacity={0.7}
          disabled={secondsLeft > 0 || isResending}
          onPress={handleResend}
          style={styles.resendRow}
        >
          <Text style={[styles.resendText, secondsLeft > 0 && styles.resendTextDisabled]}>
            {secondsLeft > 0
              ? `Resend OTP in 00:${String(secondsLeft).padStart(2, '0')}`
              : 'Resend OTP'}
          </Text>
        </TouchableOpacity>
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
  identifier: {
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.xxl,
  },
  otpBox: {
    width: 56,
    height: 56,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.m,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  otpBoxFilled: {
    borderColor: COLORS.primary,
  },
  cta: {
    marginTop: SPACING.xxl,
  },
  resendRow: {
    alignItems: 'center',
    marginTop: SPACING.l,
  },
  resendText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: COLORS.primary,
  },
  resendTextDisabled: {
    color: COLORS.textTertiary,
  },
  errorText: {
    color: COLORS.error,
    fontSize: 12,
    marginTop: SPACING.s,
    textAlign: 'center',
  },
});

export default OtpVerificationScreen;
