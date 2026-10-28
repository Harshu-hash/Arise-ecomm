import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS } from '../../../constants/colors';
import { SPACING, RADIUS } from '../../../constants/spacing';

/** 3-column brand ad row — image with an AD tag, discount headline + subtitle below. */
const BrandsSpotlightSection = ({ brands, onPressBrand, onSeeAll }) => (
  <View style={styles.wrapper}>
    <View style={styles.titleRow}>
      <Text style={styles.title}>Brands in Spotlight</Text>
      {onSeeAll ? (
        <TouchableOpacity activeOpacity={0.7} onPress={onSeeAll}>
          <Text style={styles.seeAllText}>See All</Text>
        </TouchableOpacity>
      ) : null}
    </View>
    <View style={styles.row}>
      {brands.map((brand) => (
        <TouchableOpacity
          key={brand.id}
          activeOpacity={0.85}
          onPress={() => onPressBrand && onPressBrand(brand)}
          style={styles.card}>
          <View style={styles.imageBox}>
            <Image source={{ uri: brand.image }} style={styles.image} resizeMode="cover" />
            <View style={styles.adTag}>
              <Text style={styles.adTagText}>AD</Text>
            </View>
          </View>
          <Text style={styles.discount} numberOfLines={1}>{brand.discount}</Text>
          <Text style={styles.subtitle} numberOfLines={1}>{brand.subtitle}</Text>
        </TouchableOpacity>
      ))}
    </View>
  </View>
);

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: COLORS.white,
    paddingVertical: SPACING.l,
    marginTop: SPACING.s,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.l,
    marginBottom: SPACING.m,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },
  row: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.l,
    gap: SPACING.s,
  },
  card: {
    flex: 1,
  },
  imageBox: {
    position: 'relative',
    borderRadius: RADIUS.s,
    overflow: 'hidden',
    backgroundColor: COLORS.mutedBg,
  },
  image: {
    width: '100%',
    aspectRatio: 1.35,
  },
  adTag: {
    position: 'absolute',
    right: 6,
    top: 6,
    backgroundColor: 'rgba(255,255,255,0.85)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  adTagText: {
    color: COLORS.textPrimary,
    fontSize: 9,
    fontWeight: '700',
  },
  discount: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginTop: SPACING.s,
  },
  subtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 2,
  },
});

export default BrandsSpotlightSection;
