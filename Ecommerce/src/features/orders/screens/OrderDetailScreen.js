import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Animated, Easing } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../../constants/colors';
import { SPACING, RADIUS } from '../../../constants/spacing';
import { StatusBarManager } from '../../../shared/components';
import { ORDER_JOURNEY_STEPS, ORDER_STATUS } from '../constants/ordersData';

/** Press feedback wrapper: scales down on press-in, springs back on release. */
const Bouncy = ({ onPress, style, wrapperStyle, children }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const pressIn = () => Animated.spring(scale, { toValue: 0.92, useNativeDriver: true, speed: 60, bounciness: 0 }).start();
  const pressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 24, bounciness: 9 }).start();
  return (
    <Animated.View style={[wrapperStyle, { transform: [{ scale }] }]}>
      <TouchableOpacity activeOpacity={0.85} onPress={onPress} onPressIn={pressIn} onPressOut={pressOut} style={style}>
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
};

const OrderDetailScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const order = route?.params?.order;

  // Staggered section entrance on mount.
  const cardAnims = useRef([0, 1, 2, 3, 4].map(() => new Animated.Value(0))).current;
  // Journey steps cascade in one-by-one, like the timeline drawing itself.
  const stepAnims = useRef(ORDER_JOURNEY_STEPS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.stagger(
      90,
      cardAnims.map((v) =>
        Animated.timing(v, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true })
      )
    ).start();

    Animated.stagger(
      90,
      stepAnims.map((v) =>
        Animated.timing(v, { toValue: 1, duration: 340, delay: 120, easing: Easing.out(Easing.cubic), useNativeDriver: true })
      )
    ).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cardStyle = (v) => ({
    opacity: v,
    transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
  });
  const stepRowStyle = (v) => ({
    opacity: v,
    transform: [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [-14, 0] }) }],
  });

  if (!order) {
    return (
      <View style={styles.container}>
        <StatusBarManager barStyle="dark-content" themeColor={COLORS.surface} />
        <View style={styles.emptyWrap}>
          <Icon name="alert-circle" size={40} color={COLORS.border} />
          <Text style={styles.emptyText}>Order not found</Text>
        </View>
      </View>
    );
  }

  const isCancelled = order.status === ORDER_STATUS.CANCELLED;
  const isReturned = order.status === ORDER_STATUS.RETURNED;
  const currentStep = order.currentStep || 1;
  const price = order.priceDetails || {};

  return (
    <View style={styles.container}>
      <StatusBarManager barStyle="dark-content" themeColor={COLORS.surface} />

      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity onPress={() => navigation && navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{order.id}</Text>
          <Text style={styles.headerSubtitle}>{order.placedOn || order.date}</Text>
        </View>
        <Bouncy onPress={() => navigation && navigation.navigate('OrderIssue', { order })} style={styles.helpBtn}>
          <Icon name="help-circle" size={18} color={COLORS.primary} />
          <Text style={styles.helpBtnText}>Help</Text>
        </Bouncy>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Status */}
        {isCancelled || isReturned ? (
          <Animated.View style={[styles.statusBanner, cardStyle(cardAnims[0])]}>
            <Icon name={isCancelled ? 'x-circle' : 'rotate-ccw'} size={20} color={COLORS.error} />
            <Text style={styles.statusBannerText}>
              {isCancelled ? 'This order was cancelled' : 'This order was returned'}
            </Text>
          </Animated.View>
        ) : (
          <Animated.View style={[styles.stepperCard, cardStyle(cardAnims[0])]}>
            <Text style={styles.stepperTitle}>Order Journey</Text>
            {ORDER_JOURNEY_STEPS.map((step, idx) => {
              const stepNum = idx + 1;
              const completed = stepNum < currentStep || order.status === ORDER_STATUS.DELIVERED;
              const active = stepNum === currentStep && order.status !== ORDER_STATUS.DELIVERED;
              const isLast = idx === ORDER_JOURNEY_STEPS.length - 1;
              return (
                <Animated.View key={step} style={[styles.stepItem, stepRowStyle(stepAnims[idx])]}>
                  <View style={styles.stepIndicatorColumn}>
                    <View style={[styles.stepDot, completed && styles.stepDotCompleted, active && styles.stepDotActive]}>
                      <Icon
                        name={completed ? 'check' : active ? 'zap' : 'circle'}
                        size={11}
                        color={completed || active ? COLORS.white : COLORS.textTertiary}
                      />
                    </View>
                    {!isLast ? (
                      <View style={[styles.stepLine, completed && styles.stepLineCompleted]} />
                    ) : null}
                  </View>
                  <Text style={[styles.stepTitle, (completed || active) && styles.stepTitleHighlighted]}>
                    {step}
                  </Text>
                </Animated.View>
              );
            })}

            {order.status !== ORDER_STATUS.DELIVERED ? (
              <Bouncy style={styles.trackBtn} onPress={() => navigation && navigation.navigate('Tracking')}>
                <Icon name="map-pin" size={15} color={COLORS.white} />
                <Text style={styles.trackBtnText}>Track on Map</Text>
              </Bouncy>
            ) : null}
          </Animated.View>
        )}

        {/* Items */}
        <Animated.View style={[styles.sectionCard, cardStyle(cardAnims[1])]}>
          <Text style={styles.sectionTitle}>Items ({order.items.length})</Text>
          {order.items.map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <Image source={{ uri: item.image }} style={styles.itemImage} resizeMode="cover" />
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
                {item.variant ? <Text style={styles.itemVariant}>{item.variant}</Text> : null}
                <Text style={styles.itemQty}>Qty: {item.qty}</Text>
              </View>
              <Text style={styles.itemPrice}>₹{item.price * item.qty}</Text>
            </View>
          ))}
        </Animated.View>

        {/* Delivery address */}
        <Animated.View style={[styles.sectionCard, cardStyle(cardAnims[2])]}>
          <View style={styles.sectionTitleRow}>
            <Icon name="map-pin" size={15} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Delivery Address</Text>
          </View>
          <Text style={styles.addressName}>{order.address?.name}</Text>
          <Text style={styles.addressLine}>{order.address?.line}</Text>
          <Text style={styles.addressLine}>{order.address?.cityLine}</Text>
          <Text style={styles.addressPhone}>Phone: {order.address?.phone}</Text>
        </Animated.View>

        {/* Price breakdown */}
        <Animated.View style={[styles.sectionCard, cardStyle(cardAnims[3])]}>
          <Text style={styles.sectionTitle}>Price Details</Text>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Item Total</Text>
            <Text style={styles.priceValue}>₹{price.itemTotal}</Text>
          </View>
          {price.discount ? (
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Discount</Text>
              <Text style={[styles.priceValue, { color: COLORS.ratingGreen }]}>-₹{price.discount}</Text>
            </View>
          ) : null}
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Delivery Fee</Text>
            <Text style={styles.priceValue}>{price.deliveryFee ? `₹${price.deliveryFee}` : 'FREE'}</Text>
          </View>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Platform Fee</Text>
            <Text style={styles.priceValue}>₹{price.platformFee}</Text>
          </View>
          <View style={styles.priceDivider} />
          <View style={styles.priceRow}>
            <Text style={styles.grandLabel}>Total Paid</Text>
            <Text style={styles.grandValue}>₹{price.grandTotal}</Text>
          </View>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Payment Method</Text>
            <Text style={styles.priceValue}>{order.paymentMethod}</Text>
          </View>
        </Animated.View>

        {/* Actions */}
        <Animated.View style={[styles.actionsRow, cardStyle(cardAnims[4])]}>
          {order.canCancel ? (
            <Bouncy
              style={styles.outlineBtn}
              wrapperStyle={styles.outlineBtnWrapper}
              onPress={() => navigation && navigation.navigate('CancelOrder', { order })}>
              <Text style={[styles.outlineBtnText, { color: COLORS.error }]}>Cancel Order</Text>
            </Bouncy>
          ) : null}
          {order.canReturn ? (
            <Bouncy
              style={styles.outlineBtn}
              wrapperStyle={styles.outlineBtnWrapper}
              onPress={() => navigation && navigation.navigate('ReturnReplace', { order })}>
              <Text style={styles.outlineBtnText}>Return / Replace</Text>
            </Bouncy>
          ) : null}
          <Bouncy
            style={styles.outlineBtn}
            wrapperStyle={styles.outlineBtnWrapper}
            onPress={() => navigation && navigation.navigate('MainTabs', { screen: 'Home' })}>
            <Text style={styles.outlineBtnText}>Buy Again</Text>
          </Bouncy>
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
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    marginTop: SPACING.m,
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.l,
    paddingBottom: SPACING.m,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: {
    marginRight: SPACING.m,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  headerSubtitle: {
    fontSize: 11.5,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  helpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: SPACING.m,
    paddingVertical: 6,
    borderRadius: RADIUS.m,
  },
  helpBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.primary,
    marginLeft: 4,
  },
  scrollContent: {
    padding: SPACING.l,
    paddingBottom: SPACING.xxxl,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.offerRedLight,
    borderRadius: RADIUS.m,
    padding: SPACING.l,
    marginBottom: SPACING.m,
    gap: SPACING.s,
  },
  statusBannerText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: COLORS.error,
  },
  stepperCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.l,
    padding: SPACING.l,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    marginBottom: SPACING.m,
  },
  stepperTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: SPACING.m,
  },
  stepItem: {
    flexDirection: 'row',
    marginBottom: SPACING.s,
  },
  stepIndicatorColumn: {
    alignItems: 'center',
    width: 22,
    marginRight: SPACING.m,
  },
  stepDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.mutedBg,
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
    minHeight: 16,
    backgroundColor: COLORS.border,
    marginVertical: 2,
  },
  stepLineCompleted: {
    backgroundColor: COLORS.accentGreen,
  },
  stepTitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    paddingTop: 1,
  },
  stepTitleHighlighted: {
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  trackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.s,
    paddingVertical: SPACING.m,
    marginTop: SPACING.s,
    gap: SPACING.s,
  },
  trackBtnText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 13.5,
  },
  sectionCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.l,
    padding: SPACING.l,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    marginBottom: SPACING.m,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.m,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.m,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.m,
    marginBottom: SPACING.s,
  },
  itemImage: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.s,
    backgroundColor: COLORS.mutedBg,
  },
  itemName: {
    fontSize: 12.5,
    color: COLORS.textPrimary,
    lineHeight: 17,
  },
  itemVariant: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  itemQty: {
    fontSize: 11,
    color: COLORS.textTertiary,
    marginTop: 2,
  },
  itemPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  addressName: {
    fontSize: 13.5,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  addressLine: {
    fontSize: 12.5,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  addressPhone: {
    fontSize: 12.5,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.s,
  },
  priceLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  priceValue: {
    fontSize: 13,
    color: COLORS.textPrimary,
  },
  priceDivider: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginBottom: SPACING.s,
  },
  grandLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  grandValue: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.m,
  },
  outlineBtnWrapper: {
    flexGrow: 1,
  },
  outlineBtn: {
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.s,
    paddingVertical: SPACING.m,
    paddingHorizontal: SPACING.l,
  },
  outlineBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },
});

export default OrderDetailScreen;
