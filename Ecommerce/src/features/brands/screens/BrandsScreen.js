import React, { useMemo, useState } from 'react';
import { View, Text, Image, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../../constants/colors';
import { SPACING, RADIUS } from '../../../constants/spacing';
import { StatusBarManager } from '../../../shared/components';
import { ALL_BRANDS, BRAND_FILTERS } from '../data/brandsData';

const BrandsScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [activeFilter, setActiveFilter] = useState('All');

  const handleBack = () => {
    if (navigation && navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation && navigation.navigate('MainTabs', { screen: 'Home' });
    }
  };

  const brands = useMemo(() => {
    if (activeFilter === 'All') return ALL_BRANDS;
    if (activeFilter === 'Popular') return ALL_BRANDS.slice(0, 5);
    return ALL_BRANDS.filter((b) => b.category === activeFilter);
  }, [activeFilter]);

  return (
    <View style={styles.container}>
      <StatusBarManager barStyle="dark-content" themeColor={COLORS.surface} />

      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn} activeOpacity={0.7}>
          <Icon name="arrow-left" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>All Brands</Text>
        <View style={styles.backBtn} />
      </View>

      <FlatList
        horizontal
        data={BRAND_FILTERS}
        keyExtractor={(item) => item}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setActiveFilter(item)}
            style={[styles.filterChip, item === activeFilter && styles.filterChipActive]}>
            <Text style={[styles.filterChipText, item === activeFilter && styles.filterChipTextActive]}>
              {item}
            </Text>
          </TouchableOpacity>
        )}
      />

      <FlatList
        data={brands}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.gridContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <TouchableOpacity activeOpacity={0.85} style={styles.card}>
            <Image source={{ uri: item.image }} style={styles.image} resizeMode="cover" />
            <Text style={styles.brandName} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.discount} numberOfLines={1}>{item.discount}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.l,
    paddingBottom: SPACING.m,
  },
  backBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  filterRow: {
    paddingHorizontal: SPACING.l,
    paddingVertical: SPACING.m,
    gap: SPACING.s,
  },
  filterChip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.round,
    paddingHorizontal: SPACING.l,
    paddingVertical: SPACING.s,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterChipText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  filterChipTextActive: {
    color: COLORS.white,
  },
  gridContent: {
    paddingHorizontal: SPACING.l,
    paddingBottom: SPACING.xxl,
  },
  row: {
    gap: SPACING.m,
  },
  card: {
    flex: 1,
    marginBottom: SPACING.m,
  },
  image: {
    width: '100%',
    aspectRatio: 1.4,
    borderRadius: RADIUS.m,
    backgroundColor: COLORS.mutedBg,
  },
  brandName: {
    fontSize: 13.5,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: SPACING.s,
  },
  discount: {
    fontSize: 12,
    color: COLORS.ratingGreen,
    marginTop: 2,
  },
});

export default BrandsScreen;
