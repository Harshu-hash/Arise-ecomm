import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { GradientBackground } from '../../../shared/components';
import { haptics } from '../../../utils/haptics';
import { buildCustomerRootState } from '../../../navigation/navigationState';
import {
  useResendOtpMutation,
  useVerifyOtpMutation,
  useVerifyPasswordResetOtpMutation,
} from '../api/auth.query';

const OTP_LENGTH = 4;
const RESEND_SECONDS = 30;
const NAVY = '#0D1B3E';
const ORANGE = '#F28A0C';
const MUTED = '#6B7488';
const LINE = '#DCE3EF';
const ERROR = '#D93025';

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
      scale.value = withSpring(1.1, { damping: 10, stiffness: 220 }, () => {
        scale.value = withSpring(1, { damping: 14, stiffness: 220 });
      });
    }
  }, [digit, scale]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedTextInput
      ref={inputRef}
      value={digit}
      keyboardType="number-pad"
      maxLength={1}
      style={[styles.box, digit ? styles.boxFilled : null, animatedStyle]}
      {...inputProps}
    />
  );
};

/**
 * The code-entry step of the sign-in card. `challenge` is what starting auth returned
 * ({ challengeId, destinationMasked, resendAvailableAt, devCode }); `mode` is 'login' | 'signup' | 'reset'.
 * Verifying a login/signup signs the shopper in and opens the app; a reset goes on to choose a new password.
 */
const OtpStep = ({ navigation, challenge, identifier, mode, returnTo, onChangeIdentifier }) => {
  const [digits, setDigits] = useState(Array(OTP_LENGTH).fill(''));
  const [challengeId, setChallengeId] = useState(challenge.challengeId);
  const [destination, setDestination] = useState(challenge.destinationMasked);
  const [devCode, setDevCode] = useState(challenge.devCode);
  const [secondsLeft, setSecondsLeft] = useState(() => secondsUntil(challenge.resendAvailableAt));
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

  const handleKeyPress = (event, index) => {
    if (event.nativeEvent.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const otpValue = digits.join('');
  const canVerify = otpValue.length === OTP_LENGTH && Boolean(challengeId);
  const busy = isLoading || isVerifyingReset;
  const problem = verifyError || resetVerifyError || resendError;

  const handleVerify = async () => {
    if (!canVerify || busy) return;
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
      const next = await resendOtp({ challengeId }).unwrap();
      setChallengeId(next.challengeId);
      setDestination(next.destinationMasked);
      setDevCode(next.devHint?.code);
      haptics.selection();
      setSecondsLeft(secondsUntil(next.resendAvailableAt));
      setDigits(Array(OTP_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    } catch {
      haptics.error();
    }
  };

  return (
    <View>
      <Text style={styles.title}>Verify OTP</Text>
      <Text style={styles.subtitle}>
        {`Enter the ${OTP_LENGTH}-digit code sent to `}
        <Text style={styles.destination}>{destination || identifier || 'your number'}</Text>
      </Text>
      {onChangeIdentifier ? (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onChangeIdentifier}
          accessibilityRole="button"
        >
          <Text style={styles.change}>Wrong number or email? Change it</Text>
        </TouchableOpacity>
      ) : null}
      {devCode ? <Text style={styles.devCode}>Development code: {devCode}</Text> : null}

      <View style={styles.row}>
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
            autoFocus={index === 0}
            onChangeText={text => handleChangeDigit(text, index)}
            onKeyPress={event => handleKeyPress(event, index)}
          />
        ))}
      </View>

      <TouchableOpacity
        activeOpacity={0.85}
        onPress={handleVerify}
        disabled={!canVerify || busy}
        accessibilityRole="button"
        style={[styles.cta, !canVerify && styles.ctaDisabled]}
      >
        <GradientBackground colors={['#FFA11F', '#F07A00']} id="otp_cta" />
        {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.ctaText}>Verify</Text>}
      </TouchableOpacity>

      {problem ? (
        <Text accessibilityRole="alert" style={styles.errorText}>
          {problem.message}
        </Text>
      ) : null}

      <TouchableOpacity
        activeOpacity={0.7}
        disabled={secondsLeft > 0 || isResending}
        onPress={handleResend}
        style={styles.resendRow}
      >
        <Text style={[styles.resendText, secondsLeft > 0 && styles.resendDisabled]}>
          {secondsLeft > 0
            ? `Resend OTP in 00:${String(secondsLeft).padStart(2, '0')}`
            : 'Resend OTP'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  title: { fontSize: 20, fontWeight: '800', color: NAVY },
  subtitle: { fontSize: 13.5, color: MUTED, lineHeight: 20, marginTop: 6 },
  destination: { color: NAVY, fontWeight: '700' },
  change: { fontSize: 12.5, fontWeight: '700', color: ORANGE, marginTop: 6 },
  devCode: { fontSize: 12, color: ORANGE, marginTop: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  box: {
    width: 58,
    height: 58,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: LINE,
    backgroundColor: '#FFFFFF',
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
    color: NAVY,
    padding: 0,
  },
  boxFilled: { borderColor: ORANGE },
  cta: {
    height: 48,
    borderRadius: 17,
    marginTop: 20,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: ORANGE,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
  },
  ctaDisabled: { opacity: 0.55 },
  ctaText: { fontSize: 16.5, fontWeight: '700', color: '#FFFFFF' },
  errorText: { color: ERROR, fontSize: 12.5, marginTop: 10 },
  resendRow: { alignSelf: 'center', marginTop: 16, paddingVertical: 4 },
  resendText: { fontSize: 14, fontWeight: '700', color: ORANGE },
  resendDisabled: { color: MUTED, fontWeight: '500' },
});

export default OtpStep;
