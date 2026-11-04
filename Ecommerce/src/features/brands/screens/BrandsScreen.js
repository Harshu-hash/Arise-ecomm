import React, { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../../constants/colors';
import { RADIUS, SPACING } from '../../../constants/spacing';
import { StatusBarManager } from '../../../shared/components';
import EmptyState from '../../../shared/EmptyState/EmptyState';
import ErrorState from '../../../shared/ErrorState/ErrorState';
import { useGetBrandsQuery } from '../api/brands.query';

const BrandsScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [activeFilter, setActiveFilter] = useState('All');
  const { data, error, isLoading, isFetching, refetch } = useGetBrandsQuery({
    filter: activeFilter,
  });

  const handleBack = () => {
    if (navigation?.canGoBack()) navigation.goBack();
    else navigation?.navigate('MainTabs', { screen: 'Home' });
  };

  if (isLoading && !data) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }
  if (error && !data) return <ErrorState message={error.message} onRetry={refetch} />;

  const filters = data?.filters ?? ['All'];
  const brands = data?.items ?? [];

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

      <View style={styles.filterContainer}>
        <FlatList
          horizontal
          data={filters}
          keyExtractor={item => item}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setActiveFilter(item)}
              style={[styles.filterChip, item === activeFilter && styles.filterChipActive]}
            >
              <Text
                style={[
                  styles.filterChipText,
                  item === activeFilter && styles.filterChipTextActive,
                ]}
              >
                {item}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {brands.length === 0 ? (
        <EmptyState
          title="No brands found"
          message="Try a different brand category."
          actionLabel="Show all"
          onActionPress={() => setActiveFilter('All')}
        />
      ) : (
        <FlatList
          data={brands}
          keyExtractor={item => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.gridContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isFetching}
              onRefresh={refetch}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.card}
              onPress={() =>
                navigation?.navigate('SearchResults', { brandId: item.id, query: item.name })
              }
            >
              <Image source={{ uri: item.image }} style={styles.image} resizeMode="cover" />
              <Text style={styles.brandName} numberOfLines={1}>
                {item.name}
              </Text>
              {item.discount ? (
                <Text style={styles.discount} numberOfLines={1}>
                  {item.discount}
                </Text>
              ) : null}
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.l,
    paddingBottom: SPACING.m,
  },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  filterContainer: { height: 62 },
  filterRow: { paddingHorizontal: SPACING.l, paddingVertical: SPACING.m, gap: SPACING.s },
  filterChip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.round,
    paddingHorizontal: SPACING.l,
    paddingVertical: SPACING.s,
  },
  filterChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterChipText: { fontSize: 12.5, fontWeight: '600', color: COLORS.textSecondary },
  filterChipTextActive: { color: COLORS.white },
  gridContent: { paddingHorizontal: SPACING.l, paddingBottom: SPACING.xxl },
  row: { gap: SPACING.m },
  card: { flex: 1, marginBottom: SPACING.m },
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
  discount: { fontSize: 12, color: COLORS.ratingGreen, marginTop: 2 },
});

export default BrandsScreen;
