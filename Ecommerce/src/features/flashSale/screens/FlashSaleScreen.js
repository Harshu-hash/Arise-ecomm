import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../../constants/colors';
import { SPACING, RADIUS } from '../../../constants/spacing';
import { StatusBarManager, ProductCard } from '../../../shared/components';
import { FLASH_SALE_PRODUCTS, FLASH_SALE_DURATION_SECONDS } from '../data/flashSaleData';

const formatTime = (totalSeconds) => {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
};

const FlashSaleScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [secondsLeft, setSecondsLeft] = useState(FLASH_SALE_DURATION_SECONDS);

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
      product: { ...item, name: item.title },
    });
  };

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

      <FlatList
        data={FLASH_SALE_PRODUCTS}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.gridContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <ProductCard
            product={{ ...item, name: item.title }}
            onPress={() => handlePressProduct(item)}
            style={styles.card}
          />
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
  gridContent: {
    padding: SPACING.l,
  },
  row: {
    gap: SPACING.m,
  },
  card: {
    marginBottom: SPACING.m,
  },
});

export default FlashSaleScreen;
