import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../../constants/colors';
import { SPACING, RADIUS } from '../../../constants/spacing';
import {
  StatusBarManager,
  PriceBlock,
  RatingBadge,
  EmptyCartIllustration,
  HorizontalProductRail,
} from '../../../shared/components';
import PressableScale from '../../../shared/ui/PressableScale';
import { haptics } from '../../../utils/haptics';
import { useCart } from '../../../contexts/CartContext';
import CouponSection from '../components/CouponSection';

const MIN_QTY = 1;
const MAX_QTY = 10;

const SUGGESTED_PRODUCTS = [
  { id: 'sg1', name: 'Noise ColorFit Smartwatch', image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=400&q=80', price: 1299, mrp: 4999 },
  { id: 'sg2', name: 'Floral Print Shorts', image: 'https://images.unsplash.com/photo-1591369822096-ffd140ec948f?auto=format&fit=crop&w=400&q=80', price: 349, mrp: 899 },
  { id: 'sg3', name: 'Wireless Earbuds', image: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=400&q=80', price: 799, mrp: 1999 },
];

const CartScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { items, savedForLater, removeItem, changeQty, moveToSaved, moveToCart, appliedCoupon } = useCart();

  const handleRemove = (id) => {
    haptics.warning();
    removeItem(id);
  };

  const handleQtyChange = (id, delta) => changeQty(id, delta);

  const mrpTotal = items.reduce((sum, item) => sum + item.mrp * item.qty, 0);
  const itemTotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const fees = items.length ? 9 : 0;
  const productDiscount = mrpTotal - itemTotal;
  const couponDiscount = appliedCoupon ? appliedCoupon.amount : 0;
  const discounts = productDiscount + couponDiscount;
  const finalTotal = Math.max(itemTotal + fees - couponDiscount, 0);

  return (
    <View style={styles.container}>
      <StatusBarManager barStyle="dark-content" themeColor={COLORS.surface} />

      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <View>
          <Text style={styles.headerTitle}>My Cart</Text>
          {items.length > 0 ? (
            <Text style={styles.headerSubtitle}>
              {items.length} item{items.length > 1 ? 's' : ''} in your cart
            </Text>
          ) : null}
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {items.length === 0 ? (
          <>
            <View style={styles.emptyPanel}>
              <EmptyCartIllustration />
              <Text style={styles.emptyTitle}>Your cart is empty!</Text>
              <Text style={styles.emptySubtitle}>Looks like you haven't added anything yet.</Text>
              <PressableScale
                haptic="medium"
                onPress={() => navigation && navigation.navigate('MainTabs', { screen: 'Home' })}
                style={styles.shopNowBtn}>
                <Text style={styles.shopNowText}>Shop now</Text>
              </PressableScale>
            </View>

            <View style={styles.suggestedWrapper}>
              <Text style={styles.suggestedTitle}>Suggested for You</Text>
              <Text style={styles.suggestedSubtitle}>Based on Your Activity</Text>
              <HorizontalProductRail
                data={SUGGESTED_PRODUCTS}
                style={{ marginTop: SPACING.m }}
                onPressItem={(product) => navigation && navigation.navigate('ProductDetail', { product })}
              />
            </View>
          </>
        ) : (
          <>
            <View style={styles.deliverRow}>
              <View style={styles.deliverIconCircle}>
                <Icon name="map-pin" size={14} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.deliverText}>
                  Deliver to: <Text style={styles.deliverBold}>Harshvardhan P...</Text>, 457001
                </Text>
                <Text style={styles.deliverAddress}>84/2, Dheeraj shah nagar, Ratlam, Ratlam</Text>
              </View>
              <TouchableOpacity activeOpacity={0.8} style={styles.changeBtn}>
                <Text style={styles.changeBtnText}>Change</Text>
              </TouchableOpacity>
            </View>

            {items.map((item) => (
              <View key={item.id} style={styles.itemCard}>
                <View style={styles.itemTopRow}>
                  <View style={styles.itemImageBox}>
                    <Image source={{ uri: item.image }} style={styles.itemImage} resizeMode="cover" />
                    <View style={styles.zoomTag}>
                      <Icon name="search" size={10} color={COLORS.white} />
                      <Text style={styles.zoomTagText}>Zoom</Text>
                    </View>
                  </View>

                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
                    <Text style={styles.itemVariant}>{item.variant}</Text>
                    <View style={styles.ratingRow}>
                      <RatingBadge variant="stars" rating={item.rating} count={item.ratingCount} />
                      {item.assured ? (
                        <View style={styles.assuredRow}>
                          <Icon name="shield" size={13} color={COLORS.primary} />
                          <Text style={styles.assuredText}>Assured</Text>
                        </View>
                      ) : null}
                    </View>
                    <PriceBlock price={item.price} mrp={item.mrp} style={{ marginTop: SPACING.s }} />
                  </View>
                </View>

                <View style={styles.itemBottomRow}>
                  <View style={styles.qtyStepper}>
                    <PressableScale
                      disabled={item.qty <= MIN_QTY}
                      haptic="light"
                      onPress={() => handleQtyChange(item.id, -1)}
                      style={[styles.qtyStepperBtn, item.qty <= MIN_QTY && styles.qtyStepperBtnDisabled]}>
                      <Icon name="minus" size={13} color={item.qty <= MIN_QTY ? COLORS.textTertiary : COLORS.primary} />
                    </PressableScale>
                    <Text style={styles.qtyStepperValue}>{item.qty}</Text>
                    <PressableScale
                      disabled={item.qty >= MAX_QTY}
                      haptic="light"
                      onPress={() => handleQtyChange(item.id, 1)}
                      style={[styles.qtyStepperBtn, item.qty >= MAX_QTY && styles.qtyStepperBtnDisabled]}>
                      <Icon name="plus" size={13} color={item.qty >= MAX_QTY ? COLORS.textTertiary : COLORS.primary} />
                    </PressableScale>
                  </View>
                  <View style={styles.deliveryChip}>
                    <Icon name="truck" size={11} color={COLORS.textSecondary} />
                    <Text style={styles.deliveryText}>{`Delivery by ${item.deliveryDate}`}</Text>
                  </View>
                </View>

                <View style={styles.actionsRow}>
                  <PressableScale haptic="warning" onPress={() => handleRemove(item.id)} style={styles.actionBtn}>
                    <Icon name="trash-2" size={15} color={COLORS.textSecondary} />
                    <Text style={styles.actionText}>Remove</Text>
                  </PressableScale>
                  <View style={styles.actionDivider} />
                  <PressableScale haptic="light" onPress={() => moveToSaved(item.id)} style={styles.actionBtn}>
                    <Icon name="bookmark" size={15} color={COLORS.textSecondary} />
                    <Text style={styles.actionText}>Save for later</Text>
                  </PressableScale>
                  <View style={styles.actionDivider} />
                  <PressableScale
                    haptic="medium"
                    onPress={() =>
                      navigation && navigation.navigate('Checkout', { items: [item] })
                    }
                    style={styles.actionBtn}>
                    <Icon name="zap" size={15} color={COLORS.primary} />
                    <Text style={[styles.actionText, { color: COLORS.primary }]}>Buy this now</Text>
                  </PressableScale>
                </View>
              </View>
            ))}

            {savedForLater.length > 0 && (
              <View style={styles.savedWrapper}>
                <Text style={styles.savedTitle}>Saved for later ({savedForLater.length})</Text>
                {savedForLater.map((item) => (
                  <View key={item.id} style={styles.savedRow}>
                    <Image source={{ uri: item.image }} style={styles.savedImage} resizeMode="cover" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.savedName} numberOfLines={2}>{item.name}</Text>
                      <PriceBlock price={item.price} mrp={item.mrp} style={{ marginTop: 4 }} />
                    </View>
                    <PressableScale haptic="light" onPress={() => moveToCart(item.id)} style={styles.moveToCartBtn}>
                      <Text style={styles.moveToCartText}>Move to cart</Text>
                    </PressableScale>
                  </View>
                ))}
              </View>
            )}

            <View style={{ marginHorizontal: SPACING.l }}>
              <CouponSection itemTotal={itemTotal} />
            </View>

            <View style={styles.priceDetailsCard}>
              <Text style={styles.priceDetailsTitle}>Price Details</Text>

              {discounts > 0 ? (
                <View style={styles.savingsBanner}>
                  <Icon name="check-circle" size={13} color={COLORS.ratingGreen} />
                  <Text style={styles.savingsBannerText}>
                    You will save <Text style={styles.savingsBannerAmount}>₹{discounts}</Text> on this order
                  </Text>
                </View>
              ) : null}

              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Price ({items.length} item{items.length > 1 ? 's' : ''})</Text>
                <Text style={styles.priceValue}>{`₹${mrpTotal}`}</Text>
              </View>
              {discounts > 0 ? (
                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>Discount</Text>
                  <Text style={[styles.priceValue, styles.discountValue]}>{`-₹${discounts}`}</Text>
                </View>
              ) : null}
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Delivery Fee</Text>
                <Text style={styles.priceValue}>{`₹${fees}`}</Text>
              </View>
              <View style={styles.priceDivider} />
              <View style={styles.priceRow}>
                <Text style={styles.grandLabel}>Total Amount</Text>
                <Text style={styles.grandValue}>{`₹${finalTotal}`}</Text>
              </View>
            </View>

            <View style={styles.suggestedWrapper}>
              <Text style={styles.suggestedTitle}>You Might Also Like</Text>
              <HorizontalProductRail
                data={SUGGESTED_PRODUCTS}
                style={{ marginTop: SPACING.m }}
                onPressItem={(product) => navigation && navigation.navigate('ProductDetail', { product })}
              />
            </View>
          </>
        )}
      </ScrollView>

      {items.length > 0 ? (
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View>
            {mrpTotal > finalTotal ? <Text style={styles.bottomMrp}>₹{mrpTotal}</Text> : null}
            <View style={styles.bottomTotalRow}>
              <Text style={styles.bottomTotal}>₹{finalTotal}</Text>
            </View>
            {discounts > 0 ? (
              <Text style={styles.bottomSavings}>You save ₹{discounts}</Text>
            ) : (
              <Text style={styles.bottomTotalLabel}>Total Amount</Text>
            )}
          </View>
          <PressableScale
            haptic="medium"
            onPress={() => navigation && navigation.navigate('Checkout', { items })}
            style={styles.placeOrderBtn}>
            <Text style={styles.placeOrderText}>Place Order</Text>
            <Icon name="arrow-right" size={16} color={COLORS.textPrimary} />
          </PressableScale>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.mutedBg,
  },
  header: {
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.l,
    paddingBottom: SPACING.m,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
    zIndex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  headerSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  scrollContent: {
    paddingTop: SPACING.m,
    paddingBottom: 150,
  },
  emptyPanel: {
    backgroundColor: COLORS.white,
    alignItems: 'center',
    paddingVertical: SPACING.xxxl,
    marginHorizontal: SPACING.l,
    borderRadius: RADIUS.l,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: SPACING.l,
  },
  emptySubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
    marginBottom: SPACING.l,
  },
  shopNowBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.s + 2,
    borderRadius: RADIUS.round,
  },
  shopNowText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 14,
  },
  suggestedWrapper: {
    marginTop: SPACING.xl,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.l,
    marginHorizontal: SPACING.l,
    paddingVertical: SPACING.l,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  suggestedTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    paddingHorizontal: SPACING.l,
  },
  suggestedSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    paddingHorizontal: SPACING.l,
    marginTop: 2,
  },
  deliverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.l,
    marginHorizontal: SPACING.l,
    paddingHorizontal: SPACING.l,
    paddingVertical: SPACING.m,
    marginBottom: SPACING.m,
    gap: SPACING.m,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  deliverIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deliverText: {
    fontSize: 13,
    color: COLORS.textPrimary,
  },
  deliverBold: {
    fontWeight: '700',
  },
  deliverAddress: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  changeBtn: {
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: RADIUS.round,
    paddingHorizontal: SPACING.m,
    paddingVertical: 6,
  },
  changeBtnText: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 12,
  },
  itemCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.l,
    marginHorizontal: SPACING.l,
    padding: SPACING.l,
    marginBottom: SPACING.m,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  itemTopRow: {
    flexDirection: 'row',
    marginBottom: SPACING.m,
    gap: SPACING.m,
  },
  itemImageBox: {
    width: 84,
    height: 84,
    borderRadius: RADIUS.s,
    overflow: 'hidden',
    backgroundColor: COLORS.mutedBg,
    position: 'relative',
  },
  itemImage: {
    width: '100%',
    height: '100%',
  },
  zoomTag: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  zoomTagText: {
    color: COLORS.white,
    fontSize: 9,
    marginLeft: 3,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    color: COLORS.textPrimary,
    lineHeight: 18,
  },
  itemVariant: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.xs,
    gap: SPACING.s,
    flexWrap: 'wrap',
  },
  assuredRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  assuredText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
    marginLeft: 3,
  },
  itemBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: SPACING.m,
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBorder,
  },
  qtyStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.round,
    overflow: 'hidden',
  },
  qtyStepperBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primaryLight,
  },
  qtyStepperBtnDisabled: {
    backgroundColor: COLORS.mutedBg,
  },
  qtyStepperValue: {
    minWidth: 28,
    textAlign: 'center',
    fontSize: 12.5,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  deliveryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  deliveryText: {
    fontSize: 11.5,
    color: COLORS.textSecondary,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.m,
    paddingTop: SPACING.m,
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBorder,
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
  },
  actionText: {
    fontSize: 11.5,
    color: COLORS.textSecondary,
    marginTop: 4,
    fontWeight: '600',
  },
  actionDivider: {
    width: 1,
    height: 28,
    backgroundColor: COLORS.cardBorder,
  },
  savedWrapper: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.l,
    marginHorizontal: SPACING.l,
    padding: SPACING.l,
    marginBottom: SPACING.m,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  savedTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.m,
  },
  savedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.m,
    paddingVertical: SPACING.s,
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBorder,
  },
  savedImage: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.s,
    backgroundColor: COLORS.mutedBg,
  },
  savedName: {
    fontSize: 12.5,
    color: COLORS.textPrimary,
  },
  moveToCartBtn: {
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: RADIUS.round,
    paddingHorizontal: SPACING.m,
    paddingVertical: 6,
  },
  moveToCartText: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 11.5,
  },
  priceDetailsCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.l,
    marginHorizontal: SPACING.l,
    padding: SPACING.l,
    marginBottom: SPACING.m,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  priceDetailsTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.m,
  },
  savingsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.ratingGreenBg,
    borderRadius: RADIUS.s,
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s + 2,
    marginBottom: SPACING.m,
    gap: SPACING.s,
  },
  savingsBannerText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.ratingGreen,
  },
  savingsBannerAmount: {
    fontWeight: '800',
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
    fontWeight: '600',
  },
  discountValue: {
    color: COLORS.ratingGreen,
  },
  priceDivider: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    borderStyle: 'dashed',
    marginBottom: SPACING.s,
  },
  grandLabel: {
    fontSize: 14.5,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  grandValue: {
    fontSize: 14.5,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.white,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingHorizontal: SPACING.l,
    paddingTop: SPACING.m,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 6,
  },
  bottomMrp: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textDecorationLine: 'line-through',
  },
  bottomTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bottomTotal: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  bottomTotalLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  bottomSavings: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.ratingGreen,
    marginTop: 1,
  },
  placeOrderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.ctaYellow,
    paddingHorizontal: SPACING.xxl,
    paddingVertical: SPACING.m,
    borderRadius: RADIUS.round,
    gap: SPACING.s,
  },
  placeOrderText: {
    color: COLORS.textPrimary,
    fontWeight: '700',
    fontSize: 14,
  },
});

export default CartScreen;
