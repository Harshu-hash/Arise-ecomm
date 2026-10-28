import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../../constants/colors';
import { SPACING, RADIUS } from '../../../constants/spacing';
import { StatusBarManager } from '../../../shared/components';

const INITIAL_STEPS = [
  { id: '1', title: 'Order Confirmed', sub: 'Store accepted your order', completed: true },
  { id: '2', title: 'Items Packed', sub: 'Store packed 3 items', completed: true },
  { id: '3', title: 'Rider Assigned', sub: 'Ramesh Kumar is at store', completed: true },
  { id: '4', title: 'Out for Delivery', sub: 'Arriving in 8 mins', active: true, completed: false },
  { id: '5', title: 'Delivered', sub: 'Doorstep handover', active: false, completed: false },
];

/** Press feedback wrapper: scales down on press-in, springs back on release. */
const Bouncy = ({ onPress, style, children, disabled }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const pressIn = () => Animated.spring(scale, { toValue: 0.9, useNativeDriver: true, speed: 60, bounciness: 0 }).start();
  const pressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 24, bounciness: 9 }).start();
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        activeOpacity={0.85}
        disabled={disabled}
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        style={style}>
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
};

/** Step dot that pops with a spring bounce the moment it flips to completed. */
const StepDot = ({ step }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const wasCompleted = useRef(step.completed);

  useEffect(() => {
    if (step.completed && !wasCompleted.current) {
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.4, duration: 150, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 10 }),
      ]).start();
    }
    wasCompleted.current = step.completed;
  }, [step.completed, scale]);

  return (
    <Animated.View
      style={[
        styles.stepDot,
        step.completed && styles.stepDotCompleted,
        step.active && styles.stepDotActive,
        { transform: [{ scale }] },
      ]}>
      <Icon
        name={step.completed ? 'check' : step.active ? 'zap' : 'circle'}
        size={12}
        color={COLORS.white}
      />
    </Animated.View>
  );
};

const TrackingScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [steps, setSteps] = useState(INITIAL_STEPS);
  const [copiedOtp, setCopiedOtp] = useState(false);
  const copyResetTimer = useRef(null);

  const isFullyDelivered = steps[4].completed;

  // Staggered card entrance on mount.
  const cardAnims = useRef([0, 1, 2, 3].map(() => new Animated.Value(0))).current;
  useEffect(() => {
    Animated.stagger(
      90,
      cardAnims.map((v) =>
        Animated.timing(v, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true })
      )
    ).start();
  }, [cardAnims]);
  const cardStyle = (v) => ({
    opacity: v,
    transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
  });

  // Pulsing "live" dot next to the header status text.
  const liveDot = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (isFullyDelivered) return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(liveDot, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(liveDot, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isFullyDelivered, liveDot]);

  // Rider marker pulse ring + gentle "breathing" ETA text, only while order is in transit.
  const riderPulse = useRef(new Animated.Value(0)).current;
  const etaBreath = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (isFullyDelivered) return undefined;
    const ringLoop = Animated.loop(
      Animated.timing(riderPulse, { toValue: 1, duration: 1400, easing: Easing.out(Easing.quad), useNativeDriver: true })
    );
    const breathLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(etaBreath, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(etaBreath, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    ringLoop.start();
    breathLoop.start();
    return () => {
      ringLoop.stop();
      breathLoop.stop();
    };
  }, [isFullyDelivered, riderPulse, etaBreath]);

  useEffect(
    () => () => {
      if (copyResetTimer.current) clearTimeout(copyResetTimer.current);
    },
    []
  );

  const handleCopyOtp = () => {
    setCopiedOtp(true);
    if (copyResetTimer.current) clearTimeout(copyResetTimer.current);
    copyResetTimer.current = setTimeout(() => setCopiedOtp(false), 2000);
  };

  const handleSimulateStatus = () => {
    setSteps((prev) =>
      prev.map((step) => {
        if (step.id === '4') return { ...step, active: false, completed: true };
        if (step.id === '5') return { ...step, active: false, completed: true };
        return step;
      })
    );
  };

  const riderRingStyle = {
    opacity: riderPulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }),
    transform: [{ scale: riderPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.1] }) }],
  };
  const etaStyle = {
    transform: [{ scale: etaBreath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] }) }],
  };

  return (
    <View style={styles.container}>
      <StatusBarManager barStyle="dark-content" themeColor={COLORS.surface} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity
          onPress={() => navigation && navigation.navigate('MainTabs', { screen: 'Home' })}
          style={styles.backBtn}>
          <Icon name="arrow-left" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>

        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Order #ORD-84920</Text>
          <View style={styles.headerStatusRow}>
            {!isFullyDelivered ? (
              <Animated.View
                style={[
                  styles.liveDot,
                  {
                    opacity: liveDot.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }),
                    transform: [{ scale: liveDot.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.2] }) }],
                  },
                ]}
              />
            ) : null}
            <Text style={[styles.headerSubtitle, isFullyDelivered && { color: COLORS.accentGreen }]}>
              {isFullyDelivered ? '✓ Delivered' : 'Live Status'}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={() =>
            navigation &&
            navigation.navigate('OrderIssue', {
              order: {
                id: 'ORD-84920',
                name: 'Your order',
                image: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=400&q=80',
                price: 1299,
                date: 'Today',
                status: isFullyDelivered ? 'Delivered' : 'Out for Delivery',
                canCancel: !isFullyDelivered,
                canReturn: isFullyDelivered,
              },
            })
          }
          style={styles.supportBtn}>
          <Icon name="help-circle" size={18} color={COLORS.primary} />
          <Text style={styles.supportText}>Help</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Delivery OTP Code Banner */}
        <Animated.View style={[styles.otpBanner, cardStyle(cardAnims[0])]}>
          <View style={styles.otpLeft}>
            <Text style={styles.otpLabel}>DELIVERY CODE</Text>
            <Text style={styles.otpCode}>4829</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.otpSubtext}>Share this code with your delivery partner at doorstep</Text>
            <Bouncy onPress={handleCopyOtp} style={styles.copyBtn}>
              <View style={styles.copyBtnRow}>
                <Icon name={copiedOtp ? 'check' : 'copy'} size={11} color={COLORS.primary} />
                <Text style={styles.copyBtnText}>{copiedOtp ? 'COPIED' : 'COPY CODE'}</Text>
              </View>
            </Bouncy>
          </View>
        </Animated.View>

        {/* Live Map Preview Card */}
        <Animated.View style={[styles.mapCard, cardStyle(cardAnims[1])]}>
          <View style={styles.mapGraphic}>
            <Icon name="map-pin" size={24} color={COLORS.primary} style={styles.storePin} />
            <View style={[styles.routeLine, isFullyDelivered && { backgroundColor: COLORS.accentGreen }]} />
            <View style={styles.riderMarkerWrap}>
              {!isFullyDelivered ? <Animated.View style={[styles.riderPulseRing, riderRingStyle]} /> : null}
              <View style={[styles.riderMarker, isFullyDelivered && { backgroundColor: COLORS.accentGreen }]}>
                <Icon name={isFullyDelivered ? 'check' : 'navigation'} size={18} color={COLORS.white} />
              </View>
            </View>
            <View style={[styles.routeLineDotted, isFullyDelivered && { backgroundColor: COLORS.accentGreen }]} />
            <Icon name="home" size={24} color={COLORS.accentGreen} style={styles.homePin} />
          </View>

          <View style={styles.etaBox}>
            <Animated.Text style={[styles.etaTime, etaStyle]}>
              {isFullyDelivered ? 'DELIVERED 🎉' : '8 MINS'}
            </Animated.Text>
            <Text style={styles.etaLabel}>
              {isFullyDelivered ? 'ORDER DELIVERED TO DOORSTEP' : 'ESTIMATED ARRIVAL TIME'}
            </Text>
          </View>
        </Animated.View>

        {/* Rider Profile Card */}
        <Animated.View style={[styles.riderCard, cardStyle(cardAnims[2])]}>
          <View style={styles.riderAvatar}>
            <Icon name="user" size={24} color={COLORS.white} />
          </View>

          <View style={styles.riderDetails}>
            <Text style={styles.riderName}>Ramesh Kumar</Text>
            <Text style={styles.riderVehicle}>Honda Activa • KA 01 EA 4829</Text>
            <View style={styles.ratingBadge}>
              <Icon name="star" size={12} color="#D97706" style={{ marginRight: 2 }} />
              <Text style={styles.ratingText}>4.9 (1,240 deliveries)</Text>
            </View>
          </View>

          <View style={styles.riderActions}>
            <Bouncy style={styles.iconCircleBtn}>
              <Icon name="phone" size={16} color={COLORS.primary} />
            </Bouncy>
            <Bouncy style={styles.iconCircleBtn}>
              <Icon name="message-square" size={16} color={COLORS.primary} />
            </Bouncy>
          </View>
        </Animated.View>

        {/* Order Status Stepper */}
        <Animated.View style={[styles.stepperCard, cardStyle(cardAnims[3])]}>
          <View style={styles.stepperHeaderRow}>
            <Text style={styles.stepperTitle}>Order Journey</Text>
            {!isFullyDelivered ? (
              <Bouncy onPress={handleSimulateStatus} style={styles.simBtn}>
                <Text style={styles.simBtnText}>SIMULATE DELIVERY ⚡</Text>
              </Bouncy>
            ) : null}
          </View>

          {steps.map((step, idx) => {
            const isLast = idx === steps.length - 1;
            return (
              <View key={step.id} style={styles.stepItem}>
                <View style={styles.stepIndicatorColumn}>
                  <StepDot step={step} />
                  {!isLast ? (
                    <View
                      style={[
                        styles.stepLine,
                        step.completed && styles.stepLineCompleted,
                      ]}
                    />
                  ) : null}
                </View>

                <View style={styles.stepTextContainer}>
                  <Text
                    style={[
                      styles.stepTitle,
                      (step.completed || step.active) && styles.stepTitleHighlighted,
                    ]}>
                    {step.title}
                  </Text>
                  <Text style={styles.stepSub}>{step.sub}</Text>
                </View>
              </View>
            );
          })}
        </Animated.View>
      </ScrollView>
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
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.l,
    paddingBottom: SPACING.m,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.mutedBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleContainer: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  headerStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.primary,
    marginRight: 5,
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },
  supportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: SPACING.m,
    paddingVertical: 6,
    borderRadius: RADIUS.m,
  },
  supportText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.primary,
    marginLeft: 4,
  },
  scrollContent: {
    padding: SPACING.l,
    paddingBottom: SPACING.xxl,
  },
  otpBanner: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.l,
    padding: SPACING.l,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.m,
  },
  otpLeft: {
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.3)',
    paddingRight: SPACING.l,
    marginRight: SPACING.l,
    alignItems: 'center',
  },
  otpLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  otpCode: {
    color: COLORS.white,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 2,
  },
  otpSubtext: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 15,
    marginBottom: 6,
  },
  copyBtn: {
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.m,
    paddingVertical: 4,
    borderRadius: RADIUS.s,
    alignSelf: 'flex-start',
  },
  copyBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  copyBtnText: {
    color: COLORS.primary,
    fontWeight: '900',
    fontSize: 10,
  },
  mapCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.l,
    alignItems: 'center',
    marginBottom: SPACING.m,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  mapGraphic: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    justifyContent: 'space-between',
    marginVertical: SPACING.m,
  },
  storePin: {
    marginRight: SPACING.s,
  },
  routeLine: {
    flex: 1,
    height: 4,
    backgroundColor: COLORS.primary,
    borderRadius: 2,
  },
  riderMarkerWrap: {
    width: 32,
    height: 32,
    marginHorizontal: SPACING.s,
    alignItems: 'center',
    justifyContent: 'center',
  },
  riderPulseRing: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  riderMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  routeLineDotted: {
    flex: 1,
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
  },
  homePin: {
    marginLeft: SPACING.s,
  },
  etaBox: {
    alignItems: 'center',
    marginTop: SPACING.s,
  },
  etaTime: {
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.textPrimary,
  },
  etaLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
  },
  riderCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.l,
    padding: SPACING.l,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.m,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  riderAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.m,
  },
  riderDetails: {
    flex: 1,
  },
  riderName: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  riderVehicle: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginVertical: 1,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  riderActions: {
    flexDirection: 'row',
    gap: SPACING.s,
  },
  iconCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.l,
    padding: SPACING.l,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  stepperHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.m,
  },
  stepperTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  simBtn: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: SPACING.m,
    paddingVertical: 4,
    borderRadius: RADIUS.s,
  },
  simBtnText: {
    fontSize: 10,
    fontWeight: '900',
    color: COLORS.primary,
  },
  stepItem: {
    flexDirection: 'row',
    marginBottom: SPACING.m,
  },
  stepIndicatorColumn: {
    alignItems: 'center',
    width: 24,
    marginRight: SPACING.m,
  },
  stepDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepDotCompleted: {
    backgroundColor: COLORS.accentGreen,
  },
  stepDotActive: {
    backgroundColor: COLORS.primary,
  },
  stepLine: {
    width: 2,
    flex: 1,
    backgroundColor: COLORS.border,
    marginVertical: 2,
  },
  stepLineCompleted: {
    backgroundColor: COLORS.accentGreen,
  },
  stepTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  stepTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  stepTitleHighlighted: {
    color: COLORS.textPrimary,
    fontWeight: '800',
  },
  stepSub: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
});

export default TrackingScreen;
