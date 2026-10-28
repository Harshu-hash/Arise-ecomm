import React from 'react';
import { View, Text, Image, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../../constants/colors';
import { SPACING, RADIUS } from '../../../constants/spacing';
import { StatusBarManager, TopBrandTabs } from '../../../shared/components';
import { BRAND_TABS } from '../../home/data/homeData';
import OfferThemeSection from '../components/OfferThemeSection';

const RAKHI_ESSENTIALS = [
  { id: 're1', image: 'https://images.unsplash.com/photo-1610824352934-c10d87b700cc?auto=format&fit=crop&w=300&q=80', bannerText: 'From ₹89', label: 'Designer rakhis' },
  { id: 're2', image: 'https://images.unsplash.com/photo-1594787318286-3d835c1d207f?auto=format&fit=crop&w=300&q=80', bannerText: 'Min. 50% Off', label: 'Toys & more' },
  { id: 're3', image: 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=300&q=80', bannerText: 'Just ₹235', label: 'Mug' },
];

const RAKHI_GIFTING = [
  { id: 'rg1', image: 'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?auto=format&fit=crop&w=300&q=80', bannerText: 'Min. 30% Off', label: 'Lipstick' },
  { id: 'rg2', image: 'https://images.unsplash.com/photo-1584813470613-5a1c1cad3d69?auto=format&fit=crop&w=300&q=80', bannerText: 'Min. 40% Off', label: 'Iron' },
  { id: 'rg3', image: 'https://images.unsplash.com/photo-1522771930-78848d9293e8?auto=format&fit=crop&w=300&q=80', bannerText: 'Starting ₹399', label: 'Bedsheets' },
];

const FLASH_HOUR_DEALS = [
  { id: 'fh1', image: 'https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd?auto=format&fit=crop&w=300&q=80', bannerText: 'Min. 50% Off', label: 'Kapiva' },
  { id: 'fh2', image: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?auto=format&fit=crop&w=300&q=80', bannerText: 'Min. 60% Off', label: 'PUMA, Reebok...' },
  { id: 'fh3', image: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=300&q=80', bannerText: 'Under ₹80', label: 'Sip & chill' },
];

const GROCERY_DEALS = [
  { id: 'gd1', image: 'https://images.unsplash.com/photo-1583947581924-860bda6a26df?auto=format&fit=crop&w=300&q=80', bannerText: 'Upto 50% Off', label: 'Lizol & more' },
  { id: 'gd2', image: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=300&q=80', bannerText: 'Starting at ₹49', label: 'Dals & spices' },
  { id: 'gd3', image: 'https://images.unsplash.com/photo-1517686469429-8bdb88b9f907?auto=format&fit=crop&w=300&q=80', bannerText: 'Under ₹299', label: 'Breakfast needs' },
];

const STROKE_OFFSETS = [
  { x: -2, y: -2 }, { x: 0, y: -2 }, { x: 2, y: -2 },
  { x: -2, y: 0 }, { x: 2, y: 0 },
  { x: -2, y: 2 }, { x: 0, y: 2 }, { x: 2, y: 2 },
];

const OffersScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();

  const handleBrandSelect = (tab) => {
    if (tab.id === 'flipkart') {
      if (navigation && navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation && navigation.navigate('MainTabs', { screen: 'Home' });
      }
    }
  };

  const handleSearchPress = () => navigation && navigation.navigate('Search');

  const openDeal = (section) => (item) => {
    if (!navigation) return;
    navigation.navigate('DealDetail', {
      deal: {
        id: item.id,
        label: item.label,
        value: item.bannerText,
        image: item.image,
        tag: section.tag,
        section: section.title,
        accent: section.accent,
      },
    });
  };

  const openCategory = (section) => () => {
    if (!navigation) return;
    navigation.navigate('DealCategory', {
      category: {
        id: section.id,
        title: section.title,
        tag: section.tag,
        accent: section.accent,
        subtitle: section.subtitle,
      },
    });
  };

  return (
    <View style={styles.container}>
      <StatusBarManager barStyle="light-content" themeColor={COLORS.offerRed} />

      <View style={styles.headerZone}>
        <View style={{ paddingTop: Math.max(insets.top, 12) }}>
          <TopBrandTabs tabs={BRAND_TABS} activeId="value365" onSelect={handleBrandSelect} />

          <TouchableOpacity activeOpacity={0.9} onPress={handleSearchPress} style={styles.searchBar}>
            <Icon name="search" size={20} color={COLORS.textPrimary} style={{ marginRight: SPACING.s }} />
            <Text style={styles.searchPlaceholder}>watches</Text>
            <Icon name="camera" size={19} color={COLORS.textSecondary} style={{ marginRight: SPACING.m }} />
            <Icon name="mic" size={19} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.heroSection}>
          <Text style={[styles.decoEmoji, styles.decoPeace]}>✌🏻</Text>
          <Text style={[styles.decoEmoji, styles.decoBolt]}>⚡</Text>
          <Text style={[styles.decoEmoji, styles.decoTicket]}>🎟️</Text>

          <View style={styles.wordmarkStack}>
            {STROKE_OFFSETS.map(({ x, y }, i) => (
              <Text
                key={i}
                style={[styles.heroWordmark, styles.heroWordmarkStroke, { transform: [{ translateX: x }, { translateY: y }] }]}>
                VALUE 365
              </Text>
            ))}
            <Text style={styles.heroWordmark}>VALUE 365</Text>
          </View>

          <View style={styles.subtitleBox}>
            <Text style={styles.heroSubtitle}>LOWEST PRICES</Text>
            <Text style={styles.heroSubtitle}>EVERY DAY.</Text>
          </View>
        </View>

        <OfferThemeSection
          title="Rakhi Essentials"
          items={RAKHI_ESSENTIALS}
          variant="gradient"
          onPressItem={openDeal({ title: 'Rakhi Essentials', tag: 'FESTIVE PICK', accent: '#F5443A' })}
          onPressHeader={openCategory({
            id: 'rakhiEssentials',
            title: 'Rakhi Essentials',
            tag: 'FESTIVE PICK',
            accent: '#F5443A',
            subtitle: 'Rakhis, gifting combos & more',
          })}
        />
        <OfferThemeSection
          title="Rakhi Gifting"
          items={RAKHI_GIFTING}
          variant="gradient"
          onPressItem={openDeal({ title: 'Rakhi Gifting', tag: 'GIFT WORTHY', accent: '#F5443A' })}
          onPressHeader={openCategory({
            id: 'rakhiGifting',
            title: 'Rakhi Gifting',
            tag: 'GIFT WORTHY',
            accent: '#F5443A',
            subtitle: 'Thoughtful gifts for every sibling',
          })}
        />
        <OfferThemeSection
          title="Flash Hour Deals"
          items={FLASH_HOUR_DEALS}
          variant="gradient"
          countdownText="00d : 01h : 34m : 59s"
          onPressItem={openDeal({ title: 'Flash Hour Deals', tag: 'FLASH DEAL', accent: '#CC0C39' })}
          onPressHeader={openCategory({
            id: 'flashHourDeals',
            title: 'Flash Hour Deals',
            tag: 'FLASH DEAL',
            accent: '#CC0C39',
            subtitle: 'Steep discounts, only for the next hour',
          })}
        />
        <OfferThemeSection
          title="Deals on Grocery"
          items={GROCERY_DEALS}
          variant="solid"
          onPressItem={openDeal({ title: 'Deals on Grocery', tag: 'DAILY SAVER', accent: '#CC0C39' })}
          onPressHeader={openCategory({
            id: 'grocery',
            title: 'Deals on Grocery',
            tag: 'DAILY SAVER',
            accent: '#CC0C39',
            subtitle: 'Everyday essentials at their lowest',
          })}
        />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  headerZone: {
    position: 'relative',
    paddingBottom: SPACING.m,
    backgroundColor: COLORS.offerRed,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 24,
    paddingHorizontal: SPACING.l,
    height: 44,
    marginHorizontal: SPACING.l,
    marginTop: SPACING.m,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  searchPlaceholder: {
    flex: 1,
    fontSize: 17,
    fontWeight: '400',
    color: COLORS.textPrimary,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  heroSection: {
    backgroundColor: COLORS.offerRed,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.xxl,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  decoEmoji: {
    position: 'absolute',
    fontSize: 26,
  },
  decoPeace: {
    top: 4,
    left: 24,
    transform: [{ rotate: '-18deg' }],
  },
  decoBolt: {
    top: 60,
    right: 20,
    fontSize: 30,
    transform: [{ rotate: '8deg' }],
  },
  decoTicket: {
    bottom: 6,
    left: 20,
    fontSize: 24,
    transform: [{ rotate: '-16deg' }],
  },
  wordmarkStack: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroWordmark: {
    color: COLORS.white,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  heroWordmarkStroke: {
    position: 'absolute',
    color: '#7A0C1E',
  },
  subtitleBox: {
    backgroundColor: '#7A0C1E',
    borderRadius: RADIUS.l,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    marginTop: SPACING.l,
    marginHorizontal: SPACING.l,
    paddingVertical: SPACING.l,
    paddingHorizontal: SPACING.xxl,
    alignItems: 'center',
  },
  heroSubtitle: {
    color: COLORS.ctaYellow,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
});

export default OffersScreen;
