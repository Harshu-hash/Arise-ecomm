import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../../constants/colors';
import { SPACING, RADIUS } from '../../../constants/spacing';
import { StatusBarManager } from '../../../shared/components';

const CARDS = [
  { id: 'c1', type: 'Credit Card', brand: 'VISA', last4: '4242', holder: 'HARSHVARDHAN PANCHAL', expiry: '08/28' },
  { id: 'c2', type: 'Debit Card', brand: 'Mastercard', last4: '8871', holder: 'HARSHVARDHAN PANCHAL', expiry: '02/27' },
];

const GIFT_CARDS = [{ id: 'g1', code: 'FKGV-3391-XXXX', balance: '₹500' }];

const SavedCardsScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <StatusBarManager barStyle="dark-content" themeColor={COLORS.surface} />

      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity onPress={() => navigation && navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Saved Cards & Gift Cards</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.sectionTitle}>Credit / Debit Cards</Text>

        {CARDS.map((card) => (
          <View key={card.id} style={styles.cardBox}>
            <View style={styles.cardTopRow}>
              <Icon name="credit-card" size={20} color={COLORS.primary} />
              <Text style={styles.cardBrand}>{card.brand}</Text>
            </View>
            <Text style={styles.cardNumber}>•••• •••• •••• {card.last4}</Text>
            <View style={styles.cardBottomRow}>
              <View>
                <Text style={styles.cardMetaLabel}>CARD HOLDER</Text>
                <Text style={styles.cardMetaValue}>{card.holder}</Text>
              </View>
              <View>
                <Text style={styles.cardMetaLabel}>EXPIRES</Text>
                <Text style={styles.cardMetaValue}>{card.expiry}</Text>
              </View>
            </View>
            <TouchableOpacity activeOpacity={0.7} style={styles.removeRow}>
              <Icon name="trash-2" size={13} color={COLORS.error} />
              <Text style={styles.removeText}>Remove Card</Text>
            </TouchableOpacity>
          </View>
        ))}

        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.addBtn}
          onPress={() => navigation && navigation.navigate('AddCard')}>
          <Icon name="plus" size={17} color={COLORS.primary} />
          <Text style={styles.addBtnText}>Add New Card</Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Gift Cards</Text>
        {GIFT_CARDS.map((gc) => (
          <View key={gc.id} style={styles.giftRow}>
            <Icon name="gift" size={18} color={COLORS.ratingGreen} style={{ marginRight: SPACING.s }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.giftCode}>{gc.code}</Text>
              <Text style={styles.giftBalanceLabel}>Available balance</Text>
            </View>
            <Text style={styles.giftBalance}>{gc.balance}</Text>
          </View>
        ))}

        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.addBtn}
          onPress={() => navigation && navigation.navigate('AddGiftCard')}>
          <Icon name="plus" size={17} color={COLORS.primary} />
          <Text style={styles.addBtnText}>Add Gift Card</Text>
        </TouchableOpacity>

        <View style={styles.secureNote}>
          <Icon name="lock" size={14} color={COLORS.textTertiary} />
          <Text style={styles.secureNoteText}>
            Your card details are stored securely and encrypted end-to-end.
          </Text>
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
    fontSize: 19,
    fontWeight: '500',
    color: COLORS.textPrimary,
  },
  scrollContent: {
    paddingHorizontal: SPACING.l,
    paddingTop: SPACING.l,
    paddingBottom: SPACING.xxxl,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.m,
  },
  cardBox: {
    backgroundColor: COLORS.primaryDark,
    borderRadius: RADIUS.m,
    padding: SPACING.l,
    marginBottom: SPACING.l,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.l,
  },
  cardBrand: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: 0.5,
  },
  cardNumber: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.white,
    letterSpacing: 1.5,
    marginBottom: SPACING.l,
  },
  cardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardMetaLabel: {
    fontSize: 9.5,
    color: 'rgba(255,255,255,0.65)',
    marginBottom: 2,
  },
  cardMetaValue: {
    fontSize: 12.5,
    fontWeight: '600',
    color: COLORS.white,
  },
  removeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.l,
    gap: 6,
  },
  removeText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: COLORS.error,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: RADIUS.s,
    paddingVertical: SPACING.m,
    marginBottom: SPACING.xl,
    gap: SPACING.xs,
  },
  addBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
  giftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.s,
    padding: SPACING.m,
    marginBottom: SPACING.l,
  },
  giftCode: {
    fontSize: 13.5,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  giftBalanceLabel: {
    fontSize: 11.5,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  giftBalance: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.ratingGreen,
  },
  secureNote: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.s,
    gap: SPACING.xs,
  },
  secureNoteText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.textTertiary,
    lineHeight: 16,
  },
});

export default SavedCardsScreen;
