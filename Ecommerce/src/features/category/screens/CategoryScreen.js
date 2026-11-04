import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
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
import CategorySidebarRow from '../components/CategorySidebarRow';
import CategorySpotlightTile from '../components/CategorySpotlightTile';
import { useGetCategoryQuery, useGetCategoryTreeQuery } from '../api/category.query';

const CategoryScreen = ({ route, navigation }) => {
  const insets = useSafeAreaInsets();
  const requestedCategoryId = route?.params?.categoryId || route?.params?.category?.id;
  const requestedCategoryName = route?.params?.category?.name;
  const [selectedCategoryId, setSelectedCategoryId] = useState(requestedCategoryId ?? null);
  const {
    data: categories = [],
    error: treeError,
    isLoading: treeLoading,
    isFetching: treeFetching,
    refetch: refetchTree,
  } = useGetCategoryTreeQuery();

  useEffect(() => {
    if (selectedCategoryId || categories.length === 0) return;
    const namedCategory = categories.find(
      category => category.name.toLowerCase() === requestedCategoryName?.toLowerCase(),
    );
    setSelectedCategoryId(namedCategory?.id || categories[0].id);
  }, [categories, requestedCategoryName, selectedCategoryId]);

  const {
    data: content,
    error: contentError,
    isLoading: contentLoading,
    isFetching: contentFetching,
    refetch: refetchContent,
  } = useGetCategoryQuery(selectedCategoryId, { skip: !selectedCategoryId });

  const refresh = () => {
    refetchTree();
    if (selectedCategoryId) refetchContent();
  };

  if (treeLoading) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }
  if (treeError) return <ErrorState message={treeError.message} onRetry={refetchTree} />;
  if (categories.length === 0) {
    return (
      <EmptyState
        title="No categories available"
        message="Please check again shortly."
        actionLabel="Refresh"
        onActionPress={refetchTree}
      />
    );
  }

  return (
    <View style={styles.container}>
      <StatusBarManager barStyle="dark-content" themeColor={COLORS.surface} />
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <Text style={styles.headerTitle}>All Categories</Text>
        <View style={styles.headerIcons}>
          <TouchableOpacity
            onPress={() => navigation?.navigate('Search')}
            style={styles.headerIconBtn}
          >
            <Icon name="search" size={20} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconBtn}>
            <Icon name="camera" size={20} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation?.navigate('Cart')}
            style={styles.headerIconBtn}
          >
            <Icon name="shopping-cart" size={20} color={COLORS.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.sidebar}>
          <FlatList
            data={categories}
            keyExtractor={item => item.id}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <CategorySidebarRow
                item={item}
                isSelected={item.id === selectedCategoryId}
                onPress={() => setSelectedCategoryId(item.id)}
              />
            )}
          />
        </View>

        {contentLoading ? (
          <View style={styles.contentState}>
            <ActivityIndicator color={COLORS.primary} />
          </View>
        ) : contentError ? (
          <ErrorState
            title={contentError.status === 404 ? 'Category not found' : undefined}
            message={contentError.message}
            onRetry={refetchContent}
            style={styles.contentState}
          />
        ) : !content || (!content.heroBanner && content.sections.length === 0) ? (
          <EmptyState
            title="This category is empty"
            message="Try another category from the list."
            style={styles.contentState}
          />
        ) : (
          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.contentInner}
            refreshControl={
              <RefreshControl
                refreshing={treeFetching || contentFetching}
                onRefresh={refresh}
                colors={[COLORS.primary]}
                tintColor={COLORS.primary}
              />
            }
          >
            {content.heroBanner ? (
              <TouchableOpacity
                style={styles.heroBanner}
                activeOpacity={0.85}
                onPress={() => navigation?.navigate('SearchResults', { categoryId: content.id })}
              >
                <View style={styles.heroBannerTextBox}>
                  <Text style={styles.heroBannerTitle} numberOfLines={1}>
                    {content.heroBanner.title}
                  </Text>
                  <View style={styles.heroArrow}>
                    <Icon name="arrow-right" size={16} color={COLORS.white} />
                  </View>
                </View>
                <Image
                  source={{ uri: content.heroBanner.image }}
                  style={styles.heroBannerImage}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            ) : null}

            {content.sections.map(section => (
              <View key={section.id} style={styles.section}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <View style={styles.grid}>
                  {section.items.map(item => (
                    <CategorySpotlightTile
                      key={item.id}
                      item={item}
                      onPress={() =>
                        navigation?.navigate('SearchResults', {
                          categoryId: content.id,
                          query: item.label,
                        })
                      }
                    />
                  ))}
                  {section.viewAll ? (
                    <TouchableOpacity
                      style={styles.viewAllTile}
                      onPress={() =>
                        navigation?.navigate('SearchResults', { categoryId: content.id })
                      }
                    >
                      <View style={styles.viewAllImageBox}>
                        <View style={styles.viewAllCircle}>
                          <Icon name="arrow-down" size={18} color={COLORS.primary} />
                        </View>
                      </View>
                      <Text style={styles.label}>View All</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.l,
    paddingBottom: SPACING.m,
  },
  headerTitle: { fontSize: 20, fontWeight: '500', color: COLORS.textPrimary },
  headerIcons: { flexDirection: 'row', gap: SPACING.l },
  headerIconBtn: { padding: 2 },
  body: { flex: 1, flexDirection: 'row' },
  sidebar: { width: 84, backgroundColor: COLORS.mutedBg },
  content: { flex: 1, backgroundColor: COLORS.white },
  contentState: { flex: 1, paddingHorizontal: SPACING.m },
  contentInner: { padding: SPACING.l, paddingBottom: 100 },
  heroBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.l,
    padding: SPACING.l,
    marginBottom: SPACING.xl,
    overflow: 'hidden',
  },
  heroBannerTextBox: { flex: 1, marginRight: SPACING.m },
  heroBannerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.s,
  },
  heroArrow: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.black,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroBannerImage: { width: 110, height: 80, borderRadius: RADIUS.s },
  section: { marginBottom: SPACING.xl },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: SPACING.m,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.s },
  viewAllTile: { width: '31%' },
  viewAllImageBox: {
    width: '100%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewAllCircle: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.round,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
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

export default CategoryScreen;
