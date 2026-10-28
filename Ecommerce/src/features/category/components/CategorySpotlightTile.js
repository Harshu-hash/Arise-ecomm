import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS } from '../../../constants/colors';
import { SPACING, RADIUS } from '../../../constants/spacing';

const BADGE_COLORS = {
  buyNow: COLORS.ratingGreen,
  notifyMe: COLORS.ratingGreen,
  recent: '#0F8B8D',
  applyNow: '#8B2FC9',
  title: null,
};

/** 3-column grid tile used across every "In the Spotlight / Upcoming Launches / ..." section. */
const CategorySpotlightTile = ({ item, onPress }) => (
  <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={styles.tile}>
    <View style={styles.imageBox}>
      <Image source={{ uri: item.image }} style={styles.image} resizeMode="cover" />
      {item.badge ? (
        item.badgeVariant === 'title' ? (
          <View style={styles.titleOverlay}>
            <Text style={styles.titleOverlayText} numberOfLines={2}>{item.badge}</Text>
          </View>
        ) : (
          <View style={[styles.badge, { backgroundColor: BADGE_COLORS[item.badgeVariant] || COLORS.primary }]}>
            <Text style={styles.badgeText} numberOfLines={1}>{item.badge}</Text>
          </View>
        )
      ) : null}
    </View>
    <Text style={styles.label} numberOfLines={2}>{item.label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  tile: {
    width: '31%',
  },
  imageBox: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: RADIUS.s,
    backgroundColor: COLORS.mutedBg,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'flex-end',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  badge: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingVertical: 3,
    alignItems: 'center',
  },
  badgeText: {
    color: COLORS.white,
    fontSize: 9,
    fontWeight: '700',
  },
  titleOverlay: {
    position: 'absolute',
    top: 6,
    left: 6,
    right: 6,
  },
  titleOverlayText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '800',
  },
  label: {
    fontSize: 11.5,
    color: COLORS.textPrimary,
    textAlign: 'center',
    lineHeight: 14,
    minHeight: 28,
    marginTop: SPACING.xs,
  },
});

export default CategorySpotlightTile;
