import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../../constants/colors';
import { SPACING, RADIUS } from '../../../constants/spacing';
import { StatusBarManager } from '../../../shared/components';
import EmptyState from '../../../shared/EmptyState/EmptyState';
import { RECENTLY_VIEWED } from '../../home/data/homeData';

const RecentlyViewedScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState(RECENTLY_VIEWED);

  const handleBack = () => {
    if (navigation && navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation && navigation.navigate('MainTabs', { screen: 'Home' });
    }
  };

  const handleClearAll = () => setItems([]);

  const handlePressItem = (item) => {
    navigation && navigation.navigate('Category', { category: { name: item.title } });
  };

  return (
    <View style={styles.container}>
      <StatusBarManager barStyle="dark-content" themeColor={COLORS.surface} />

      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn} activeOpacity={0.7}>
          <Icon name="arrow-left" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Recently Viewed</Text>
        {items.length > 0 ? (
          <TouchableOpacity onPress={handleClearAll} activeOpacity={0.7}>
            <Text style={styles.clearText}>Clear All</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.backBtn} />
        )}
      </View>

      {items.length === 0 ? (
        <EmptyState
          icon="clock"
          title="Nothing viewed yet"
          message="Products you view will show up here so you can find them again easily."
          actionLabel="Start Shopping"
          onActionPress={() => navigation && navigation.navigate('MainTabs', { screen: 'Home' })}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.gridContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity activeOpacity={0.85} onPress={() => handlePressItem(item)} style={styles.card}>
              <Image source={{ uri: item.image }} style={styles.image} resizeMode="cover" />
              <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.itemSubtitle} numberOfLines={1}>{item.subtitle}</Text>
            </TouchableOpacity>
          )}
        />
      )}
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
    justifyContent: 'space-between',
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
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  clearText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: COLORS.primary,
  },
  gridContent: {
    padding: SPACING.l,
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
    aspectRatio: 1,
    borderRadius: RADIUS.m,
    backgroundColor: COLORS.mutedBg,
  },
  itemTitle: {
    fontSize: 13,
    color: COLORS.textPrimary,
    marginTop: SPACING.s,
  },
  itemSubtitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: 2,
  },
});

export default RecentlyViewedScreen;
