import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import MaterialIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import Animated, {
  Easing,
  FadeIn,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { StatusBarManager, GradientBackground } from '../../../shared/components';
import { useStartAuthMutation } from '../api/auth.query';
import { useIdentifierField } from '../validators/identifier';
import OtpStep from '../components/OtpStep';

const NAVY = '#0D1B3E';
const ORANGE = '#F28A0C';
const MUTED = '#6B7488';
const LINE = '#DCE3EF';
const ERROR = '#D93025';
const FEATURES = [
  { icon: 'truck-fast-outline', label: 'Fast Delivery' },
  { icon: 'shield-check-outline', label: 'Secure Payment' },
  { icon: 'storefront-outline', label: 'Wide Selection' },
];

const SLIDE_MS = 280;
const TAB_PADDING = 3;

// Everything that moves runs on Reanimated's UI thread, so a busy JS thread cannot make the toggle stutter.

// Grows open (height + fade) when `progress` goes 0 -> 1; the content is measured off-flow so it can start collapsed.
const Reveal = ({ progress, open, children }) => {
  const measured = useSharedValue(0);
  const style = useAnimatedStyle(() => ({
    height: measured.value * progress.value,
    opacity: progress.value,
  }));
  return (
    <Animated.View
      pointerEvents={open ? 'auto' : 'none'}
      importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
      style={[styles.reveal, style]}
    >
      <View
        style={styles.revealInner}
        onLayout={event => {
          measured.value = event.nativeEvent.layout.height;
        }}
      >
        {children}
      </View>
    </Animated.View>
  );
};

// A tab's icon in both colours stacked, cross-fading with the pill (icon colour cannot be animated on the UI thread).
const TabIcon = ({ name, progress, activeAt }) => {
  const onPill = useAnimatedStyle(() => ({
    opacity: activeAt === 0 ? 1 - progress.value : progress.value,
  }));
  const offPill = useAnimatedStyle(() => ({
    opacity: activeAt === 0 ? progress.value : 1 - progress.value,
  }));
  return (
    <View style={styles.tabIcon}>
      <Animated.View style={[StyleSheet.absoluteFill, onPill]}>
        <Icon name={name} size={17} color="#FFFFFF" />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, offPill]}>
        <Icon name={name} size={17} color={NAVY} />
      </Animated.View>
    </View>
  );
};

const TabLabel = ({ children, progress, activeAt }) => {
  const style = useAnimatedStyle(() => ({
    color: interpolateColor(
      progress.value,
      [0, 1],
      activeAt === 0 ? ['#FFFFFF', NAVY] : [NAVY, '#FFFFFF'],
    ),
  }));
  return <Animated.Text style={[styles.tabText, style]}>{children}</Animated.Text>;
};

const LabeledInput = ({ label, icon, error, style, ...inputProps }) => (
  <View style={style}>
    <Text style={styles.label}>{label}</Text>
    <View style={[styles.input, error && styles.inputError]}>
      <Icon name={icon} size={20} color={NAVY} />
      <TextInput
        placeholderTextColor="#8A93A6"
        autoCorrect={false}
        style={styles.inputText}
        {...inputProps}
      />
    </View>
    {error ? (
      <Text accessibilityRole="alert" style={styles.errorText}>
        {error}
      </Text>
    ) : null}
  </View>
);

const LoginScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const field = useIdentifierField();
  const { value: identifier, setValue: setIdentifier } = field;
  const [name, setName] = useState('');
  const [referralCode, setReferralCode] = useState(route?.params?.referralCode ?? ''); // arrives from an invite link (arise://signup?referralCode=...)
  const [startAuth, { isLoading, error, reset }] = useStartAuthMutation();
  const returnTo = route?.params?.returnTo;
  const canGoBack = navigation?.canGoBack?.();
  const params = route?.params ?? {};

  // The OtpVerification route (used by forgot password) opens this same screen already on the code step.
  const startedOnOtp = route?.name === 'OtpVerification';
  const [otp, setOtp] = useState(
    startedOnOtp
      ? {
          challenge: {
            challengeId: params.challengeId,
            destinationMasked: params.destinationMasked,
            resendAvailableAt: params.resendAvailableAt,
            devCode: params.devCode,
          },
          identifier: params.identifier,
          mode: params.mode ?? 'login',
        }
      : null,
  );

  // The Signup route (and invite links) open this same screen with the Sign Up tab selected.
  const startsAsSignup = route?.name === 'Signup' || Boolean(route?.params?.referralCode);
  const [signup, setSignup] = useState(startsAsSignup);
  const progress = useSharedValue(startsAsSignup ? 1 : 0); // 0 = Login, 1 = Sign Up: drives the pill, tab colours and the fields
  const [tabsWidth, setTabsWidth] = useState(0);

  const selectMode = toSignup => {
    if (toSignup === signup) return;
    setSignup(toSignup);
    reset();
    progress.value = withTiming(toSignup ? 1 : 0, {
      duration: SLIDE_MS,
      easing: Easing.out(Easing.cubic),
    });
  };

  const canSubmit = field.valid && (!signup || Boolean(name.trim()));
  const fieldError = field.error ?? error?.fieldErrors?.identifier;
  const slot = Math.max(0, (tabsWidth - TAB_PADDING * 2) / 2);
  const pillStyle = useAnimatedStyle(() => ({
    width: slot,
    transform: [{ translateX: progress.value * slot }],
  }));
  const handleSubmit = async () => {
    if (!canSubmit) return;
    try {
      const challenge = await startAuth({
        identifier: identifier.trim(),
        purpose: signup ? 'SIGNUP' : 'LOGIN',
        ...(signup ? { name: name.trim() } : {}),
        ...(signup && referralCode.trim() ? { referralCode: referralCode.trim() } : {}),
      }).unwrap();
      setOtp({
        challenge: {
          challengeId: challenge.challengeId,
          destinationMasked: challenge.destinationMasked,
          resendAvailableAt: challenge.resendAvailableAt,
          devCode: challenge.devHint?.code,
        },
        identifier: identifier.trim(),
        mode: signup ? 'signup' : 'login',
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
      <StatusBarManager barStyle="dark-content" themeColor="#F1EFFF" />
      <GradientBackground colors={['#F1EFFF', '#FBF7FF', '#FFF4EA']} id="login_bg" />
      <Svg
        style={styles.wave}
        width="100%"
        height={110}
        viewBox="0 0 360 110"
        preserveAspectRatio="none"
        pointerEvents="none"
      >
        <Path fill="#FCD9AE" d="M0 70 C70 30 150 50 230 80 S330 90 360 30 L360 110 L0 110 Z" />
        <Path fill="#F9B565" d="M120 110 C200 70 290 90 360 55 L360 110 Z" />
      </Svg>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingTop: Math.max(insets.top, 24) }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          {canGoBack || (otp && !startedOnOtp) ? (
            <TouchableOpacity
              onPress={() => (otp && !startedOnOtp ? setOtp(null) : navigation.goBack())}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              style={styles.backBtn}
            >
              <Icon name="arrow-left" size={24} color={NAVY} />
            </TouchableOpacity>
          ) : (
            <View style={styles.backBtn} />
          )}
          <Image
            source={require('../../../assets/images/login_hero.png')}
            style={styles.illustration}
            resizeMode="contain"
          />
          <Image
            source={require('../../../assets/images/arise-logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.welcome}>Welcome to</Text>
          <Text style={styles.brand}>Arise</Text>
          <Text style={styles.tagline}>
            {'Shop from your favorite\nstores, anytime, anywhere.'}
          </Text>
        </View>

        <View style={styles.features}>
          {FEATURES.map((feature, index) => (
            <React.Fragment key={feature.label}>
              {index ? <View style={styles.featureDivider} /> : null}
              <View style={styles.feature}>
                <View style={styles.featureIcon}>
                  <MaterialIcon name={feature.icon} size={26} color={ORANGE} />
                </View>
                <Text style={styles.featureLabel}>{feature.label}</Text>
              </View>
            </React.Fragment>
          ))}
        </View>

        <View style={styles.card}>
          {otp ? (
            <Animated.View key="otp" entering={FadeIn.duration(260)}>
              <OtpStep
                navigation={navigation}
                challenge={otp.challenge}
                identifier={otp.identifier}
                mode={otp.mode}
                returnTo={returnTo}
                onChangeIdentifier={startedOnOtp ? null : () => setOtp(null)}
              />
            </Animated.View>
          ) : (
            <Animated.View key="form" entering={FadeIn.duration(260)}>
              <View
                style={styles.tabs}
                onLayout={event => setTabsWidth(event.nativeEvent.layout.width)}
              >
                <Animated.View pointerEvents="none" style={[styles.tabPill, pillStyle]} />
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => selectMode(false)}
                  style={styles.tab}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: !signup }}
                >
                  <TabIcon name="user" progress={progress} activeAt={0} />
                  <TabLabel progress={progress} activeAt={0}>
                    Login
                  </TabLabel>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => selectMode(true)}
                  style={styles.tab}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: signup }}
                >
                  <TabIcon name="user-plus" progress={progress} activeAt={1} />
                  <TabLabel progress={progress} activeAt={1}>
                    Sign Up
                  </TabLabel>
                </TouchableOpacity>
              </View>

              <Reveal progress={progress} open={signup}>
                <LabeledInput
                  label="Full name"
                  icon="user"
                  value={name}
                  onChangeText={setName}
                  placeholder="Enter your name"
                  error={error?.fieldErrors?.name}
                />
              </Reveal>

              <LabeledInput
                label="Mobile number or Email"
                icon={signup ? 'smartphone' : 'user'}
                value={identifier}
                onChangeText={setIdentifier}
                onBlur={field.onBlur}
                placeholder="Enter mobile number or email"
                autoCapitalize="none"
                maxLength={254}
                error={fieldError}
              />

              <Reveal progress={progress} open={signup}>
                <LabeledInput
                  label="Referral code (optional)"
                  icon="gift"
                  value={referralCode}
                  onChangeText={setReferralCode}
                  placeholder="Have a friend's invite code?"
                  autoCapitalize="characters"
                  error={error?.fieldErrors?.referralCode}
                />
              </Reveal>

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleSubmit}
                disabled={!canSubmit || isLoading}
                accessibilityRole="button"
                style={[styles.cta, !canSubmit && styles.ctaDisabled]}
              >
                <GradientBackground colors={['#FFA11F', '#F07A00']} id="login_cta" />
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Text style={styles.ctaText}>{signup ? 'Create Account' : 'Continue'}</Text>
                    <Icon name="arrow-right" size={17} color="#FFFFFF" />
                  </>
                )}
              </TouchableOpacity>

              {error &&
              !error.fieldErrors?.name &&
              !error.fieldErrors?.identifier &&
              !error.fieldErrors?.referralCode ? (
                <Text accessibilityRole="alert" style={styles.errorText}>
                  {error.message}
                </Text>
              ) : null}

              <View style={styles.terms}>
                <Icon name="shield" size={24} color={ORANGE} />
                <Text style={styles.termsText}>
                  {"By continuing, you agree to Arise's\n"}
                  <Text
                    style={styles.termsLink}
                    accessibilityRole="link"
                    onPress={() => navigation?.navigate('TermsConditions')}
                  >
                    Terms of Use
                  </Text>{' '}
                  and{' '}
                  <Text
                    style={styles.termsLink}
                    accessibilityRole="link"
                    onPress={() => navigation?.navigate('PrivacyPolicy')}
                  >
                    Privacy Policy
                  </Text>
                  .
                </Text>
              </View>
            </Animated.View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F4FF' },
  wave: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  scrollContent: { paddingBottom: 44 },
  hero: { paddingHorizontal: 24, minHeight: 250 },
  backBtn: { width: 32, height: 32, justifyContent: 'center', marginLeft: -4 },
  illustration: { position: 'absolute', right: 0, top: 18, width: 146, height: 196 },
  logo: { width: 64, height: 64, borderRadius: 16, marginTop: 10 },
  welcome: { fontSize: 26, fontWeight: '800', color: NAVY, marginTop: 14, lineHeight: 31 },
  brand: { fontSize: 34, fontWeight: '800', color: ORANGE, lineHeight: 39 },
  tagline: { fontSize: 13, color: MUTED, lineHeight: 19, marginTop: 6 },
  features: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, marginTop: 4 },
  feature: { flex: 1, alignItems: 'center' },
  featureIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#FFEFD9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureLabel: { fontSize: 12, fontWeight: '600', color: NAVY, marginTop: 6 },
  featureDivider: { width: 1, height: 54, backgroundColor: LINE },
  card: {
    marginHorizontal: 12,
    marginTop: 18,
    padding: 14,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: '#EEF1F8',
    elevation: 3,
    shadowColor: '#3B2F8F',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#EEF1F8',
    borderRadius: 22,
    padding: TAB_PADDING,
  },
  tabPill: {
    position: 'absolute',
    top: TAB_PADDING,
    left: TAB_PADDING,
    bottom: TAB_PADDING,
    borderRadius: 19,
    backgroundColor: NAVY,
  },
  tab: {
    flex: 1,
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  tabText: { fontSize: 14, fontWeight: '700' },
  reveal: { overflow: 'hidden' },
  tabIcon: { width: 17, height: 17 },
  revealInner: { position: 'absolute', left: 0, right: 0 },
  label: { fontSize: 13.5, fontWeight: '700', color: NAVY, marginTop: 16, marginBottom: 8 },
  input: {
    height: 46,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: LINE,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 12,
  },
  inputError: { borderColor: ERROR },
  inputText: { flex: 1, fontSize: 14.5, color: NAVY, paddingVertical: 0 },
  errorText: { color: ERROR, fontSize: 12.5, marginTop: 8 },
  cta: {
    height: 48,
    borderRadius: 17,
    marginTop: 16,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    elevation: 4,
    shadowColor: ORANGE,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
  },
  ctaDisabled: { opacity: 0.55 },
  ctaText: { fontSize: 16.5, fontWeight: '700', color: '#FFFFFF' },
  terms: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 18,
  },
  termsText: { fontSize: 12, color: MUTED, lineHeight: 18 },
  termsLink: { color: ORANGE, fontWeight: '700' },
});

export default LoginScreen;
