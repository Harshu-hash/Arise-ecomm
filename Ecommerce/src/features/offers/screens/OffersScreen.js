import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../../constants/colors';
import { SPACING } from '../../../constants/spacing';
import { StatusBarManager, TopBrandTabs } from '../../../shared/components';
import FullScreenLoader from '../../../shared/loaders/FullScreenLoader';
import ErrorState from '../../../shared/ErrorState/ErrorState';
import OfferThemeSection from '../components/OfferThemeSection';
import { useGetPromotionsQuery } from '../api/offers.api';

const OffersScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { data, isLoading, error, refetch } = useGetPromotionsQuery();

  if (isLoading) return <FullScreenLoader message="Loading offers..." />;
  if (error && !data) return <ErrorState message={error.message} onRetry={refetch} />;

  const openHome = tab => {
    if (tab.id !== 'arise') return;
    if (navigation?.canGoBack()) navigation.goBack();
    else navigation?.navigate('MainTabs', { screen: 'Home' });
  };
  const openDeal = section => item =>
    navigation?.navigate('DealDetail', {
      dealId: section.id,
      deal: {
        id: section.id,
        productId: item.productId,
        label: item.label,
        value: item.bannerText,
        image: item.image,
        tag: section.tag,
        section: section.title,
        accent: section.accent,
      },
    });
  const openCategory = section => () =>
    navigation?.navigate('DealCategory', { category: section });

  return (
    <View style={styles.container}>
      <StatusBarManager barStyle="light-content" themeColor={COLORS.offerRed} />
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <TopBrandTabs
          tabs={data?.brandTabs || []}
          activeId="value365"
          onSelect={openHome}
        />
        <TouchableOpacity style={styles.search} onPress={() => navigation?.navigate('Search')}>
          <Icon name="search" size={20} color={COLORS.textPrimary} />
          <Text style={styles.searchText}>Search products and offers</Text>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>ARISE DEALS</Text>
          <Text style={styles.heroSubtitle}>Server-verified prices and eligibility</Text>
        </View>
        {(data?.items || []).map(section => (
          <OfferThemeSection
            key={section.id}
            title={section.title}
            items={section.items}
            variant={section.variant}
            countdownText={section.tag === 'FLASH DEAL' ? 'Limited time' : undefined}
            onPressItem={openDeal(section)}
            onPressHeader={openCategory(section)}
          />
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { backgroundColor: COLORS.offerRed, paddingBottom: SPACING.m },
  search: {
    height: 44,
    marginHorizontal: SPACING.l,
    marginTop: SPACING.m,
    paddingHorizontal: SPACING.l,
    borderRadius: 24,
    backgroundColor: COLORS.white,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.s,
  },
  searchText: { color: COLORS.textSecondary, fontSize: 14 },
  content: { paddingBottom: SPACING.xxl },
  hero: { backgroundColor: COLORS.offerRed, alignItems: 'center', padding: SPACING.xl },
  heroTitle: { color: COLORS.white, fontSize: 30, fontWeight: '900' },
  heroSubtitle: { color: COLORS.white, marginTop: SPACING.xs, opacity: 0.9 },
});

export default OffersScreen;
