import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../../constants/colors';
import { SPACING, RADIUS } from '../../../constants/spacing';
import { StatusBarManager, AccountListRow } from '../../../shared/components';
import { ACCOUNT_SECTIONS } from '../constants/accountSections';
import { useAppBoot } from '../../../contexts/AppBootContext';

const QUICK_ACTIONS = [
  { id: 'orders', label: 'Orders', icon: 'package', bg: '#E5EEFF', color: COLORS.primary },
  { id: 'wishlist', label: 'Wishlist', icon: 'heart', bg: '#FDE7EC', color: COLORS.offerRed },
  { id: 'coupons', label: 'Coupons', icon: 'gift', bg: COLORS.ratingGreenBg, color: COLORS.ratingGreen },
  { id: 'notifications', label: 'Notifications', icon: 'bell', bg: '#F1E9FF', color: '#7A3DF0' },
  { id: 'help', label: 'Help Center', icon: 'headphones', bg: COLORS.etaGoldLight, color: COLORS.warning },
];

const ProfileScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { isLoggedIn } = useAppBoot();
  const email = 'harshvardhanpanc145@gmail...';

  return (
    <View style={styles.container}>
      <StatusBarManager barStyle="dark-content" themeColor={COLORS.surface} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: Math.max(insets.top, 12), paddingBottom: 100 + insets.bottom },
        ]}>
        {!isLoggedIn ? (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => navigation && navigation.navigate('Login')}
            style={styles.loginBanner}>
            <View style={styles.loginAvatar}>
              <Icon name="user" size={20} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.loginTitle}>Login to your account</Text>
              <Text style={styles.loginSubtitle}>Access orders, wishlist & more</Text>
            </View>
            <Icon name="chevron-right" size={18} color={COLORS.textTertiary} />
          </TouchableOpacity>
        ) : (
          <View style={styles.userCard}>
            <View style={styles.userCardTopRow}>
              <Text style={styles.userEmail} numberOfLines={1}>{email}</Text>
              <View style={styles.coinPill}>
                <Icon name="zap" size={12} color={COLORS.ctaYellow} />
                <Text style={styles.coinText}>0</Text>
              </View>
            </View>
            <Text style={styles.userCardCopy}>
              Enjoy FREE YouTube Premium, Early Access to sale and more with Black.
            </Text>
            <TouchableOpacity activeOpacity={0.85} style={styles.exploreBlackBtn}>
              <Text style={styles.exploreBlackText}>
                Explore <Text style={{ fontWeight: '900' }}>BLACK</Text>
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.quickGrid}>
          {QUICK_ACTIONS.map((action) => (
            <TouchableOpacity
              key={action.id}
              activeOpacity={0.8}
              onPress={() => {
                if (!navigation) return;
                if (action.id === 'orders') navigation.navigate('MyOrders');
                if (action.id === 'coupons') navigation.navigate('Coupons');
                if (action.id === 'wishlist') navigation.navigate('Wishlist');
                if (action.id === 'notifications') navigation.navigate('Notifications');
                if (action.id === 'help') navigation.navigate('HelpCenter');
              }}
              style={styles.quickCard}>
              <View style={[styles.quickIconCircle, { backgroundColor: action.bg }]}>
                <Icon name={action.icon} size={18} color={action.color} />
              </View>
              <Text style={styles.quickLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {ACCOUNT_SECTIONS.map((section, index) => (
          <View key={section.title} style={[styles.section, index > 0 && styles.sectionDivider]}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.rows.map((row) => (
              <AccountListRow
                key={row.id}
                icon={row.icon}
                label={row.label}
                onPress={row.route ? () => navigation && navigation.navigate(row.route) : undefined}
              />
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {},
  loginBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryLight,
    marginHorizontal: SPACING.l,
    borderRadius: RADIUS.m,
    padding: SPACING.l,
    gap: SPACING.m,
  },
  loginAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  loginSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  userCard: {
    backgroundColor: COLORS.primaryLight,
    marginHorizontal: SPACING.l,
    borderRadius: RADIUS.m,
    padding: SPACING.l,
  },
  userCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  userEmail: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginRight: SPACING.s,
  },
  coinPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.ctaYellow,
    borderRadius: RADIUS.round,
    paddingHorizontal: SPACING.s,
    paddingVertical: 3,
  },
  coinText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginLeft: 3,
  },
  userCardCopy: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: SPACING.m,
    lineHeight: 18,
  },
  exploreBlackBtn: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.black,
    borderRadius: RADIUS.round,
    paddingHorizontal: SPACING.l,
    paddingVertical: SPACING.s,
    marginTop: SPACING.m,
  },
  exploreBlackText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '600',
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: SPACING.l,
    marginTop: SPACING.l,
    gap: SPACING.s,
  },
  quickCard: {
    width: '47.5%',
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.s,
    paddingVertical: SPACING.m,
    paddingHorizontal: SPACING.m,
  },
  quickIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.s,
  },
  quickLabel: {
    fontSize: 13.5,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  section: {
    backgroundColor: COLORS.surface,
    marginTop: SPACING.l,
    paddingTop: SPACING.s,
  },
  sectionDivider: {
    marginTop: SPACING.s,
    borderTopWidth: 6,
    borderTopColor: COLORS.background,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    paddingHorizontal: SPACING.l,
    paddingTop: SPACING.m,
    paddingBottom: SPACING.s,
  },
});

export default ProfileScreen;
