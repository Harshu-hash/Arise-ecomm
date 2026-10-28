import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS } from '../../constants/colors';
import { SPACING, RADIUS } from '../../constants/spacing';
import PressableScale from '../ui/PressableScale';
import { haptics } from '../../utils/haptics';

/**
 * Grocery-style grid product card — image with ETA pill, discount tag, name/unit,
 * price block, and an ADD button that turns into a quantity stepper once in the cart.
 * Used on Search results.
 */
const ProductCard = ({ product, quantity = 0, onIncrement, onDecrement, onPress, style }) => {
  const { name, unit, price, mrp, discount, eta, image } = product || {};

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={[styles.card, style]}>
      <View style={styles.imageBox}>
        {image ? (
          <Image source={typeof image === 'string' ? { uri: image } : image} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={styles.placeholder} />
        )}
        {eta ? (
          <View style={styles.etaPill}>
            <Text style={styles.etaText}>{eta}</Text>
          </View>
        ) : null}
      </View>

      {discount ? (
        <View style={styles.discountPill}>
          <Text style={styles.discountText}>{discount}</Text>
        </View>
      ) : null}

      <Text style={styles.name} numberOfLines={2}>{name}</Text>
      {unit ? <Text style={styles.unit}>{unit}</Text> : null}

      <View style={styles.bottomRow}>
        <View style={styles.priceBlock}>
          <Text style={styles.price}>{`₹${price}`}</Text>
          {mrp != null && mrp > price ? <Text style={styles.mrp}>{`₹${mrp}`}</Text> : null}
        </View>

        {quantity > 0 ? (
          <View style={styles.stepper}>
            <PressableScale
              onPress={onDecrement}
              haptic="light"
              style={styles.stepperBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.stepperBtnText}>−</Text>
            </PressableScale>
            <Text style={styles.stepperQty}>{quantity}</Text>
            <PressableScale
              onPress={onIncrement}
              haptic="light"
              style={styles.stepperBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.stepperBtnText}>+</Text>
            </PressableScale>
          </View>
        ) : (
          <PressableScale
            onPress={() => {
              haptics.medium();
              onIncrement?.();
            }}
            haptic={false}
            style={styles.addBtn}>
            <Text style={styles.addBtnText}>ADD</Text>
          </PressableScale>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    width: 160,
    backgroundColor: COLORS.white,
  },
  imageBox: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: COLORS.mutedBg,
    borderRadius: RADIUS.s,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: SPACING.xs,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    flex: 1,
    backgroundColor: COLORS.mutedBg,
  },
  etaPill: {
    position: 'absolute',
    left: 6,
    top: 6,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: RADIUS.xs,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  etaText: {
    color: COLORS.white,
    fontSize: 9,
    fontWeight: '700',
  },
  discountPill: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.ratingGreenBg,
    borderRadius: RADIUS.xs,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: 2,
  },
  discountText: {
    color: COLORS.ratingGreen,
    fontSize: 10,
    fontWeight: '700',
  },
  name: {
    fontSize: 12.5,
    color: COLORS.textPrimary,
    lineHeight: 16,
    minHeight: 32,
  },
  unit: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.s,
  },
  priceBlock: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    flexShrink: 1,
  },
  price: {
    fontSize: 13.5,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  mrp: {
    fontSize: 11,
    color: COLORS.strikethrough,
    textDecorationLine: 'line-through',
  },
  addBtn: {
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: RADIUS.s,
    paddingHorizontal: SPACING.m,
    paddingVertical: 5,
  },
  addBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: COLORS.primary,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.s,
    paddingHorizontal: 6,
  },
  stepperBtn: {
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  stepperBtnText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '800',
  },
  stepperQty: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '700',
    minWidth: 14,
    textAlign: 'center',
  },
});

export default ProductCard;
