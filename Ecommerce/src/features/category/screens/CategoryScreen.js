import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, ScrollView, FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../../constants/colors';
import { SPACING, RADIUS } from '../../../constants/spacing';
import { StatusBarManager } from '../../../shared/components';
import CategorySidebarRow from '../components/CategorySidebarRow';
import CategorySpotlightTile from '../components/CategorySpotlightTile';
import { MAIN_SIDEBAR_CATEGORIES, getCategoryContent } from '../data/categoriesData';

const CategoryScreen = ({ route, navigation }) => {
  const insets = useSafeAreaInsets();
  const initialCategory = route?.params?.category;

  const initialMatch =
    MAIN_SIDEBAR_CATEGORIES.find(
      (c) => c.name.toLowerCase() === (initialCategory?.name || '').toLowerCase()
    ) || MAIN_SIDEBAR_CATEGORIES[0];

  const [selectedCategoryId, setSelectedCategoryId] = useState(initialMatch.id);
  const content = getCategoryContent(selectedCategoryId);

  return (
    <View style={styles.container}>
      <StatusBarManager barStyle="dark-content" themeColor={COLORS.surface} />

      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <Text style={styles.headerTitle}>All Categories</Text>
        <View style={styles.headerIcons}>
          <TouchableOpacity onPress={() => navigation && navigation.navigate('Search')} style={styles.headerIconBtn}>
            <Icon name="search" size={20} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconBtn}>
            <Icon name="camera" size={20} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation && navigation.navigate('Cart')} style={styles.headerIconBtn}>
            <Icon name="shopping-cart" size={20} color={COLORS.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.sidebar}>
          <ScrollView showsVerticalScrollIndicator={false}>
            {MAIN_SIDEBAR_CATEGORIES.map((item) => (
              <CategorySidebarRow
                key={item.id}
                item={item}
                isSelected={item.id === selectedCategoryId}
                onPress={() => setSelectedCategoryId(item.id)}
              />
            ))}
          </ScrollView>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={styles.contentInner}>
          {content.heroBanner ? (
            <View style={styles.heroBanner}>
              <View style={styles.heroBannerTextBox}>
                <Text style={styles.heroBannerTitle} numberOfLines={1}>{content.heroBanner.title}</Text>
                <View style={styles.heroArrow}>
                  <Icon name="arrow-right" size={16} color={COLORS.white} />
                </View>
              </View>
              <Image source={{ uri: content.heroBanner.image }} style={styles.heroBannerImage} resizeMode="cover" />
            </View>
          ) : null}

          {content.sections.map((section) => (
            <View key={section.title} style={styles.section}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <View style={styles.grid}>
                {section.items.map((item) => (
                  <CategorySpotlightTile
                    key={item.id}
                    item={item}
                    onPress={() => navigation && navigation.navigate('SearchResults', { query: item.label })}
                  />
                ))}
                {section.viewAll ? (
                  <View style={styles.viewAllTile}>
                    <View style={styles.viewAllImageBox}>
                      <View style={styles.viewAllCircle}>
                        <Icon name="arrow-down" size={18} color={COLORS.primary} />
                      </View>
                    </View>
                    <Text style={styles.label}>View All</Text>
                  </View>
                ) : null}
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.l,
    paddingBottom: SPACING.m,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '500',
    color: COLORS.textPrimary,
  },
  headerIcons: {
    flexDirection: 'row',
    gap: SPACING.l,
  },
  headerIconBtn: {
    padding: 2,
  },
  body: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebar: {
    width: 84,
    backgroundColor: COLORS.mutedBg,
  },
  content: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  contentInner: {
    padding: SPACING.l,
    paddingBottom: 100,
  },
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
  heroBannerTextBox: {
    flex: 1,
    marginRight: SPACING.m,
  },
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
  heroBannerImage: {
    width: 110,
    height: 80,
    borderRadius: RADIUS.s,
  },
  section: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: SPACING.m,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.s,
  },
  viewAllTile: {
    width: '31%',
  },
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
