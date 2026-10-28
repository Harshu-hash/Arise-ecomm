import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated, Easing, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import Svg, { Path } from 'react-native-svg';
import { COLORS } from '../../../constants/colors';
import { SPACING, RADIUS } from '../../../constants/spacing';
import { StatusBarManager } from '../../../shared/components';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const CHECK_DASH_LENGTH = 28;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

const CONFETTI_COLORS = [
  COLORS.primary,
  COLORS.ctaYellow,
  COLORS.ratingGreen,
  COLORS.offerRed,
  COLORS.campaignGradientEnd,
  COLORS.primaryDark,
];

const generateConfetti = () =>
  Array.from({ length: 22 }).map((_, i) => ({
    key: `c${i}`,
    left: SCREEN_WIDTH / 2 + (Math.random() - 0.5) * 220,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    isCircle: Math.random() > 0.5,
    size: 6 + Math.random() * 6,
    drift: (Math.random() - 0.5) * 140,
    fall: 220 + Math.random() * 160,
    burst: 30 + Math.random() * 40,
    rotation: `${Math.round((Math.random() - 0.5) * 720)}deg`,
    duration: 1400 + Math.random() * 600,
    delay: Math.random() * 220,
    anim: new Animated.Value(0),
  }));

const ConfettiPiece = ({ piece }) => {
  const translateY = piece.anim.interpolate({
    inputRange: [0, 0.18, 1],
    outputRange: [0, -piece.burst, piece.fall],
  });
  const translateX = piece.anim.interpolate({ inputRange: [0, 1], outputRange: [0, piece.drift] });
  const rotate = piece.anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', piece.rotation] });
  const opacity = piece.anim.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.confettiPiece,
        {
          left: piece.left,
          width: piece.size,
          height: piece.size,
          backgroundColor: piece.color,
          borderRadius: piece.isCircle ? piece.size / 2 : 2,
          opacity,
          transform: [{ translateX }, { translateY }, { rotate }],
        },
      ]}
    />
  );
};

const OrderPlacedScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const order = route?.params?.order;
  const itemCount = order?.items?.length || 1;

  const confetti = useRef(null);
  if (!confetti.current) confetti.current = generateConfetti();

  const circleScale = useRef(new Animated.Value(0)).current;
  const checkProgress = useRef(new Animated.Value(0)).current;
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const contentAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(
      25,
      confetti.current.map((piece) =>
        Animated.timing(piece.anim, {
          toValue: 1,
          duration: piece.duration,
          delay: piece.delay,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      )
    ).start();

    Animated.loop(
      Animated.stagger(300, [
        Animated.timing(ring1, { toValue: 1, duration: 1000, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(ring2, { toValue: 1, duration: 1000, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]),
      { iterations: 2 }
    ).start();

    Animated.timing(contentAnim, {
      toValue: 1,
      duration: 480,
      delay: 150,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    Animated.sequence([
      Animated.spring(circleScale, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }),
      Animated.timing(checkProgress, {
        toValue: 1,
        duration: 380,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ringStyle = (ringAnim) => ({
    opacity: ringAnim.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] }),
    transform: [{ scale: ringAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] }) }],
  });

  const contentStyle = {
    opacity: contentAnim,
    transform: [
      { translateY: contentAnim.interpolate({ inputRange: [0, 1], outputRange: [22, 0] }) },
    ],
  };

  return (
    <View style={styles.container}>
      <StatusBarManager barStyle="dark-content" themeColor={COLORS.surface} />

      <View style={styles.confettiLayer} pointerEvents="none">
        {confetti.current.map((piece) => (
          <ConfettiPiece key={piece.key} piece={piece} />
        ))}
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: Math.max(insets.top, SPACING.xxl), paddingBottom: Math.max(insets.bottom, SPACING.xxxl) },
        ]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.successIconWrap}>
          <Animated.View style={[styles.pulseRing, ringStyle(ring1)]} />
          <Animated.View style={[styles.pulseRing, ringStyle(ring2)]} />

          <Animated.View style={[styles.successIconCircle, { transform: [{ scale: circleScale }] }]}>
            <Svg width={40} height={40} viewBox="0 0 24 24">
              <AnimatedPath
                d="M5 13l4 4L19 7"
                stroke={COLORS.white}
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                strokeDasharray={`${CHECK_DASH_LENGTH},${CHECK_DASH_LENGTH}`}
                strokeDashoffset={checkProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [CHECK_DASH_LENGTH, 0],
                })}
              />
            </Svg>
          </Animated.View>
        </View>

        <Animated.View style={contentStyle}>
          <Text style={styles.title}>Order Placed Successfully!</Text>
          <Text style={styles.subtitle}>
            Thank you for shopping with us. {itemCount > 1 ? 'Your items have' : 'Your item has'} been confirmed
            and will be delivered soon.
          </Text>

          {order ? (
            <View style={styles.orderCard}>
              <View style={styles.orderRow}>
                <Text style={styles.orderRowLabel}>Order ID</Text>
                <Text style={styles.orderRowValue}>{order.id}</Text>
              </View>
              <View style={styles.orderRow}>
                <Text style={styles.orderRowLabel}>Placed On</Text>
                <Text style={styles.orderRowValue}>{order.placedOn}</Text>
              </View>
              <View style={styles.orderRow}>
                <Text style={styles.orderRowLabel}>Payment Method</Text>
                <Text style={styles.orderRowValue}>{order.paymentMethod}</Text>
              </View>
              <View style={styles.orderRow}>
                <Text style={styles.orderRowLabel}>Amount Paid</Text>
                <Text style={styles.orderRowValue}>₹{order.priceDetails?.grandTotal}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.orderRow}>
                <Text style={styles.orderRowLabel}>Delivering to</Text>
                <Text style={[styles.orderRowValue, { flex: 1, textAlign: 'right' }]} numberOfLines={2}>
                  {order.address?.line}
                </Text>
              </View>
            </View>
          ) : null}

          <View style={styles.actions}>
            <TouchableOpacity
              activeOpacity={0.9}
              style={styles.primaryBtn}
              onPress={() => navigation && navigation.navigate('OrderDetail', { order })}>
              <Icon name="map-pin" size={16} color={COLORS.white} />
              <Text style={styles.primaryBtnText}>Track Order</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.secondaryBtn}
              onPress={() => navigation && navigation.navigate('MainTabs', { screen: 'Home' })}>
              <Text style={styles.secondaryBtnText}>Continue Shopping</Text>
            </TouchableOpacity>
          </View>
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
  confettiLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
  },
  confettiPiece: {
    position: 'absolute',
    top: 90,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successIconWrap: {
    width: 84,
    height: 84,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xl,
  },
  pulseRing: {
    position: 'absolute',
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 2,
    borderColor: COLORS.success,
  },
  successIconCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: COLORS.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    marginTop: SPACING.s,
    marginBottom: SPACING.xl,
  },
  orderCard: {
    alignSelf: 'stretch',
    backgroundColor: COLORS.mutedBg,
    borderRadius: RADIUS.m,
    padding: SPACING.l,
    marginBottom: SPACING.xxl,
  },
  orderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.s,
  },
  orderRowLabel: {
    fontSize: 12.5,
    color: COLORS.textSecondary,
  },
  orderRowValue: {
    fontSize: 12.5,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginVertical: SPACING.s,
  },
  actions: {
    alignSelf: 'stretch',
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.s,
    paddingVertical: SPACING.m,
    gap: SPACING.s,
    marginBottom: SPACING.m,
  },
  primaryBtnText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 15,
  },
  secondaryBtn: {
    alignItems: 'center',
    paddingVertical: SPACING.m,
  },
  secondaryBtnText: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 14,
  },
});

export default OrderPlacedScreen;
