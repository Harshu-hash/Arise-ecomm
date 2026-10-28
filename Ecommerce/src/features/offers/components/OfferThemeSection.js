import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../../constants/colors';
import { SPACING, RADIUS } from '../../../constants/spacing';
import { GradientBackground } from '../../../shared/components';

/**
 * Repeated thematic offer panel ("Rakhi Essentials", "Flash Hour Deals", "Deals on Grocery"...).
 * variant: 'gradient' (campaign colors) | 'solid' (flat red)
 * Tapping the title/"See All" opens the full category grid (onPressHeader);
 * tapping an item image opens that single deal's spotlight page (onPressItem).
 */
const OfferThemeSection = ({ title, items, variant = 'gradient', countdownText, onPressItem, onPressHeader }) => (
  <View style={styles.panel}>
    {variant === 'gradient' ? (
      <GradientBackground colors={[COLORS.campaignGradientStart, COLORS.campaignGradientEnd]} />
    ) : (
      <View style={[StyleSheet.absoluteFill, { backgroundColor: COLORS.offerRed }]} />
    )}

    <View style={styles.content}>
      <TouchableOpacity
        activeOpacity={onPressHeader ? 0.7 : 1}
        disabled={!onPressHeader}
        onPress={onPressHeader}
        style={styles.headerRow}>
        <Text style={styles.title}>{title}</Text>
        {onPressHeader ? (
          <View style={styles.seeAllBtn}>
            <Text style={styles.seeAllText}>See All</Text>
            <Icon name="chevron-right" size={14} color={COLORS.white} />
          </View>
        ) : null}
      </TouchableOpacity>
      {countdownText ? (
        <View style={styles.countdownPill}>
          <Text style={styles.countdownText}>{`Ends in ${countdownText}`}</Text>
        </View>
      ) : null}

      <View style={styles.row}>
        {items.map((item) => (
          <TouchableOpacity key={item.id} activeOpacity={0.85} onPress={() => onPressItem && onPressItem(item)} style={styles.card}>
            <View style={styles.imageBox}>
              <Image source={{ uri: item.image }} style={styles.image} resizeMode="cover" />
              <View style={styles.banner}>
                <Text style={styles.bannerText} numberOfLines={1}>{item.bannerText}</Text>
              </View>
            </View>
            <Text style={styles.label} numberOfLines={1}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  </View>
);

const styles = StyleSheet.create({
  panel: {
    borderRadius: RADIUS.l,
    marginHorizontal: SPACING.l,
    marginTop: SPACING.l,
    overflow: 'hidden',
    backgroundColor: COLORS.campaignGradientStart,
  },
  content: {
    padding: SPACING.l,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.s,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.white,
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingHorizontal: SPACING.s,
    paddingVertical: 4,
    borderRadius: RADIUS.round,
  },
  seeAllText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: COLORS.white,
  },
  countdownPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: SPACING.s,
    paddingVertical: 4,
    borderRadius: RADIUS.xs,
    marginBottom: SPACING.m,
  },
  countdownText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    gap: SPACING.s,
    marginTop: SPACING.s,
  },
  card: {
    flex: 1,
  },
  imageBox: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: RADIUS.s,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    overflow: 'hidden',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  banner: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.offerRed,
    paddingVertical: 4,
    alignItems: 'center',
  },
  bannerText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: '700',
  },
  label: {
    fontSize: 11.5,
    color: COLORS.white,
    marginTop: SPACING.xs,
    textAlign: 'center',
  },
});

export default OfferThemeSection;
