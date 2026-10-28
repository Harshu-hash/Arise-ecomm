import React from 'react';
import { View, Text, Image, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../../constants/colors';
import { SPACING, RADIUS } from '../../../constants/spacing';
import { GradientBackground } from '../../../shared/components';

/**
 * Clean & authentic "Top Value Deals" section for Flipkart / Value 365.
 */
const TopValueDealsSection = ({ deals, onPressDeal }) => (
  <View style={styles.container}>
    <GradientBackground colors={['#FFD98A', '#FFB3C6', '#A8D4FF']} id="top_value_deals_grad" />
    <View style={styles.header}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>Top Value Deals</Text>
        <View style={styles.valueBadge}>
          <Text style={styles.valueBadgeText}>VALUE 365</Text>
        </View>
      </View>

      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => onPressDeal && onPressDeal(deals && deals[0])}
        style={styles.seeAllBtn}>
        <Text style={styles.seeAllText}>See All</Text>
        <Icon name="chevron-right" size={14} color={COLORS.primary} />
      </TouchableOpacity>
    </View>

    <View style={styles.listWrapper}>
      <FlatList
        horizontal
        data={deals}
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => onPressDeal && onPressDeal(item)}
            style={styles.card}>
            <View style={styles.imageWrapper}>
              <Image source={{ uri: item.image }} style={styles.image} resizeMode="cover" />
              <View style={styles.dealTag}>
                <Text style={styles.dealTagText} numberOfLines={1}>{item.value}</Text>
              </View>
            </View>
            <Text style={styles.label} numberOfLines={1}>{item.label}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#A8D4FF',
    marginHorizontal: SPACING.l,
    marginTop: SPACING.m,
    borderRadius: RADIUS.xl,
    paddingTop: SPACING.m,
    paddingBottom: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.l,
    marginBottom: SPACING.s,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  valueBadge: {
    backgroundColor: '#7A0C1E',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  valueBadgeText: {
    color: COLORS.ctaYellow,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },
  listWrapper: {
    height: 130,
  },
  listContent: {
    paddingHorizontal: SPACING.l,
    gap: 12,
  },
  card: {
    width: 104,
  },
  imageWrapper: {
    width: 104,
    height: 104,
    borderRadius: RADIUS.s,
    overflow: 'hidden',
    backgroundColor: COLORS.mutedBg,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  dealTag: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.offerRed,
    paddingVertical: 3,
    alignItems: 'center',
  },
  dealTagText: {
    color: COLORS.white,
    fontSize: 10.5,
    fontWeight: '700',
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.textPrimary,
    marginTop: 6,
    textAlign: 'center',
  },
});

export default TopValueDealsSection;
