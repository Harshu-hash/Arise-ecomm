import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS } from '../../../constants/colors';
import { SPACING, RADIUS } from '../../../constants/spacing';

/** 3-column ad tile row — image with a colored bottom banner strip, label below the tile. */
const AdTileRow = ({ tiles, onPressTile }) => (
  <View style={styles.row}>
    {tiles.map((tile) => (
      <TouchableOpacity key={tile.id} activeOpacity={0.85} onPress={() => onPressTile && onPressTile(tile)} style={styles.tile}>
        <View style={styles.imageBox}>
          <Image source={{ uri: tile.image }} style={styles.image} resizeMode="cover" />
          <View style={styles.banner}>
            <Text style={styles.bannerText} numberOfLines={1}>{tile.bannerText}</Text>
          </View>
        </View>
        <Text style={styles.label} numberOfLines={1}>{tile.label}</Text>
      </TouchableOpacity>
    ))}
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.l,
    paddingVertical: SPACING.l,
    backgroundColor: COLORS.white,
    gap: SPACING.s,
  },
  tile: {
    flex: 1,
  },
  imageBox: {
    borderRadius: RADIUS.s,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: COLORS.mutedBg,
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
    fontSize: 10.5,
    fontWeight: '700',
  },
  label: {
    fontSize: 11.5,
    color: COLORS.textPrimary,
    marginTop: SPACING.xs,
    textAlign: 'center',
  },
});

export default AdTileRow;
