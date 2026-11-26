import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../../constants/colors';
import { SPACING } from '../../../constants/spacing';
import { StatusBarManager } from '../../../shared/components';
import ProductFeedSection from '../../home/components/ProductFeedSection';
import FullScreenLoader from '../../../shared/loaders/FullScreenLoader';
import ErrorState from '../../../shared/ErrorState/ErrorState';
import EmptyState from '../../../shared/EmptyState/EmptyState';
import { useGetFlashSaleQuery } from '../api/flashSale.api';

const formatTime = (totalSeconds) => {
  const d = Math.floor(totalSeconds / 86400);
  const h = Math.floor((totalSeconds % 86400) / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return `${d ? `${d}d ` : ''}${pad(h)}h ${pad(m)}m ${pad(s)}s`;
};

const FlashSaleScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const campaignId = route?.params?.campaignId;
  const { data: sale, isLoading, error, refetch } = useGetFlashSaleQuery(campaignId, { skip: !campaignId });
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    setSecondsLeft(
      sale?.endsAt ? Math.max(0, Math.floor((new Date(sale.endsAt).getTime() - Date.now()) / 1000)) : 0,
    );
  }, [sale?.endsAt]);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleBack = () => {
    if (navigation && navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation && navigation.navigate('MainTabs', { screen: 'Home' });
    }
  };

  const handlePressProduct = (item) => {
    navigation && navigation.navigate('ProductDetail', {
      productId: item.productId,
    });
  };

  if (isLoading) return <FullScreenLoader message="Loading flash sale..." />;
  if (error && !sale) return <ErrorState message={error.message} onRetry={refetch} />;
  if (!sale?.items.length)
    return <EmptyState icon="clock" title="No flash sale right now" message="Check back soon." />;

  return (
    <View style={styles.container}>
      <StatusBarManager barStyle="light-content" themeColor={COLORS.offerRed} />

      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn} activeOpacity={0.7}>
          <Icon name="arrow-left" size={20} color={COLORS.white} />
        </TouchableOpacity>
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerTitle}>⚡ Flash Sale</Text>
          <Text style={styles.headerSubtitle}>Deals end in {formatTime(secondsLeft)}</Text>
        </View>
        <View style={styles.backBtn} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <ProductFeedSection title={null} products={sale.items} onPressProduct={handlePressProduct} />
      </ScrollView>
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
    backgroundColor: COLORS.offerRed,
    paddingHorizontal: SPACING.l,
    paddingBottom: SPACING.m,
  },
  backBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextWrap: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.white,
  },
  headerSubtitle: {
    fontSize: 11.5,
    color: COLORS.white,
    opacity: 0.9,
    marginTop: 2,
  },
});

export default FlashSaleScreen;
