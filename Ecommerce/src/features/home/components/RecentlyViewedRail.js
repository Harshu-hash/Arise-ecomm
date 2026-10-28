import React from 'react';
import { View, Text, Image, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { COLORS } from '../../../constants/colors';
import { SPACING, RADIUS } from '../../../constants/spacing';
import { GradientBackground } from '../../../shared/components';

/** "Still looking for these?" recently-viewed rail — square image + 2-line label. */
const RecentlyViewedRail = ({ items, onPressItem, onSeeAll }) => (
  <View style={styles.wrapper}>
    <GradientBackground colors={['#CFE3FF', '#FFD9EC']} id="recently_viewed_grad" />
    <View style={styles.titleRow}>
      <Text style={styles.title}>Still looking for these?</Text>
      {onSeeAll ? (
        <TouchableOpacity activeOpacity={0.7} onPress={onSeeAll}>
          <Text style={styles.seeAllText}>See All</Text>
        </TouchableOpacity>
      ) : null}
    </View>
    {/*
      A plain View with an explicit height, not FlatList's own `style`, is what
      guarantees this row's full content height reaches the wrapper's overflow:hidden
      clip — see the matching note in TopValueDealsSection.js.
    */}
    <View style={styles.listWrapper}>
      <FlatList
        horizontal
        data={items}
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: SPACING.l }}
        renderItem={({ item }) => (
          <TouchableOpacity activeOpacity={0.85} onPress={() => onPressItem && onPressItem(item)} style={styles.card}>
            <Image source={{ uri: item.image }} style={styles.image} resizeMode="cover" />
            <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.itemSubtitle} numberOfLines={1}>{item.subtitle}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  </View>
);

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#FFD9EC',
    paddingTop: SPACING.m,
    paddingBottom: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.l,
    marginBottom: SPACING.s,
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
  listWrapper: {
    height: 140,
  },
  card: {
    width: 100,
    marginRight: SPACING.m,
  },
  image: {
    width: 100,
    height: 100,
    borderRadius: RADIUS.s,
    backgroundColor: COLORS.mutedBg,
    marginBottom: SPACING.xs,
  },
  itemTitle: {
    fontSize: 12,
    lineHeight: 16,
    color: COLORS.textPrimary,
  },
  itemSubtitle: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: 2,
  },
});

export default RecentlyViewedRail;
