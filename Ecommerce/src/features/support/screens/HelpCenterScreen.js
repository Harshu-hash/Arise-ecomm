import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../../constants/colors';
import { SPACING, RADIUS } from '../../../constants/spacing';
import { StatusBarManager, AccountListRow } from '../../../shared/components';
import { HELP_CATEGORIES } from '../constants/helpData';

const QUICK_ACTIONS = [
  { id: 'track', icon: 'map-pin', label: 'Track Order' },
  { id: 'cancel', icon: 'x-circle', label: 'Cancel Order' },
  { id: 'return', icon: 'refresh-ccw', label: 'Return / Refund' },
  { id: 'ticket', icon: 'file-text', label: 'Report a Problem' },
];

const HelpCenterScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();

  const handleQuickAction = (id) => {
    if (!navigation) return;
    if (id === 'track') navigation.navigate('OrderHelp', { intent: 'track' });
    if (id === 'cancel') navigation.navigate('OrderHelp', { intent: 'cancel' });
    if (id === 'return') navigation.navigate('OrderHelp', { intent: 'return' });
    if (id === 'ticket') navigation.navigate('RaiseTicket', {});
  };

  return (
    <View style={styles.container}>
      <StatusBarManager barStyle="dark-content" themeColor={COLORS.surface} />

      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity onPress={() => navigation && navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help Center</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <TouchableOpacity
          activeOpacity={0.8}
          style={styles.searchBar}
          onPress={() => navigation && navigation.navigate('OrderHelp', {})}>
          <Icon name="search" size={16} color={COLORS.textTertiary} />
          <Text style={styles.searchPlaceholder}>Search for help (orders, refunds, returns...)</Text>
        </TouchableOpacity>

        <View style={styles.quickGrid}>
          {QUICK_ACTIONS.map((action) => (
            <TouchableOpacity
              key={action.id}
              activeOpacity={0.8}
              style={styles.quickCard}
              onPress={() => handleQuickAction(action.id)}>
              <View style={styles.quickIconBox}>
                <Icon name={action.icon} size={18} color={COLORS.primary} />
              </View>
              <Text style={styles.quickLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          activeOpacity={0.8}
          style={styles.ticketsRow}
          onPress={() => navigation && navigation.navigate('MyTickets')}>
          <Icon name="clipboard" size={18} color={COLORS.primary} />
          <Text style={styles.ticketsRowText}>View My Support Tickets</Text>
          <Icon name="chevron-right" size={16} color={COLORS.textTertiary} />
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Browse Help Topics</Text>
        <View style={styles.listGroup}>
          {HELP_CATEGORIES.map((category) => (
            <AccountListRow
              key={category.id}
              icon={category.icon}
              label={category.title}
              subtitle={category.subtitle}
              onPress={() => navigation && navigation.navigate('HelpCategory', { categoryId: category.id })}
            />
          ))}
        </View>

        <View style={styles.contactCard}>
          <Icon name="life-buoy" size={22} color={COLORS.primary} />
          <Text style={styles.contactTitle}>Still need help?</Text>
          <Text style={styles.contactSubtitle}>
            Our support team is available 24x7 to assist you with any query.
          </Text>
          <View style={styles.contactBtnRow}>
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.chatBtn}
              onPress={() => navigation && navigation.navigate('LiveChat', {})}>
              <Icon name="message-circle" size={15} color={COLORS.white} />
              <Text style={styles.chatBtnText}>Chat Now</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.callBtn}
              onPress={() => navigation && navigation.navigate('ContactUs')}>
              <Icon name="phone" size={15} color={COLORS.primary} />
              <Text style={styles.callBtnText}>Contact Us</Text>
            </TouchableOpacity>
          </View>
        </View>
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
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.l,
    paddingBottom: SPACING.m,
  },
  backBtn: {
    marginRight: SPACING.m,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '500',
    color: COLORS.textPrimary,
  },
  scrollContent: {
    paddingHorizontal: SPACING.l,
    paddingTop: SPACING.l,
    paddingBottom: SPACING.xxxl,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.mutedBg,
    borderRadius: RADIUS.s,
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.m,
    gap: SPACING.s,
    marginBottom: SPACING.xl,
  },
  searchPlaceholder: {
    fontSize: 13,
    color: COLORS.textTertiary,
    flex: 1,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.s,
    marginBottom: SPACING.l,
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
    gap: SPACING.s,
  },
  quickIconBox: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.s,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLabel: {
    fontSize: 12.5,
    fontWeight: '600',
    color: COLORS.textPrimary,
    flex: 1,
  },
  ticketsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.s,
    paddingVertical: SPACING.m,
    paddingHorizontal: SPACING.m,
    gap: SPACING.s,
    marginBottom: SPACING.xl,
  },
  ticketsRowText: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.s,
  },
  listGroup: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginBottom: SPACING.xl,
  },
  contactCard: {
    alignItems: 'center',
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.m,
    padding: SPACING.xl,
  },
  contactTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: SPACING.s,
    marginBottom: 4,
  },
  contactSubtitle: {
    fontSize: 12.5,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: SPACING.l,
  },
  contactBtnRow: {
    flexDirection: 'row',
    gap: SPACING.m,
    alignSelf: 'stretch',
  },
  chatBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.s,
    paddingVertical: SPACING.m,
    gap: SPACING.xs,
  },
  chatBtnText: {
    color: COLORS.white,
    fontSize: 13.5,
    fontWeight: '700',
  },
  callBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: RADIUS.s,
    paddingVertical: SPACING.m,
    gap: SPACING.xs,
  },
  callBtnText: {
    color: COLORS.primary,
    fontSize: 13.5,
    fontWeight: '700',
  },
});

export default HelpCenterScreen;
