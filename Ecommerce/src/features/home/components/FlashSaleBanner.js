import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../../constants/colors';
import { SPACING, RADIUS } from '../../../constants/spacing';

/** Promo strip linking into the Flash Sale screen. */
const FlashSaleBanner = ({ onPress }) => (
  <TouchableOpacity activeOpacity={0.88} onPress={onPress} style={styles.wrapper}>
    <View style={styles.iconCircle}>
      <Text style={styles.iconEmoji}>⚡</Text>
    </View>
    <View style={styles.textWrap}>
      <Text style={styles.title}>Flash Sale is live!</Text>
      <Text style={styles.subtitle}>Up to 80% off — grab it before it's gone</Text>
    </View>
    <Icon name="chevron-right" size={18} color={COLORS.white} />
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.offerRed,
    marginHorizontal: SPACING.l,
    marginTop: SPACING.m,
    borderRadius: RADIUS.m,
    padding: SPACING.m,
    gap: SPACING.m,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconEmoji: {
    fontSize: 16,
  },
  textWrap: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.white,
  },
  subtitle: {
    fontSize: 11.5,
    color: COLORS.white,
    opacity: 0.9,
    marginTop: 1,
  },
});

export default FlashSaleBanner;
