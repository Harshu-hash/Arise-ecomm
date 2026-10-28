import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { SPACING, RADIUS } from '../../../constants/spacing';

const WALLET_BANNER = require('../../../assets/images/wallet_banner_new.png');
const WAVE_BLUE = '#4E97F5';
const INK = '#0F1E42';
const GLASS_BG = 'rgba(15,30,66,0.4)';
const GLASS_BORDER = 'rgba(255,255,255,0.35)';

const WalletHeroCard = ({ topInset, balance, coins, onBack, onAddMoney, onRedeem }) => {
  return (
    <View style={styles.heroWrap}>
      <Image source={WALLET_BANNER} style={StyleSheet.absoluteFill} resizeMode="cover" />

      {/* Absolutely positioned so it adds no layout height — the hero's total height
          (and therefore how much of the banner is cropped) is driven only by the
          balance card + CTA row below, independent of the device's safe-area inset. */}
      <View style={[styles.heroTopRow, { top: topInset }]}>
        <TouchableOpacity onPress={onBack} style={styles.iconBtn}>
          <Icon name="arrow-left" size={19} color={INK} />
        </TouchableOpacity>
        <Text style={styles.heroHeaderTitle}>My Wallet</Text>
        <TouchableOpacity style={styles.iconBtn}>
          <Icon name="help-circle" size={19} color={INK} />
        </TouchableOpacity>
      </View>

      <View style={[styles.heroBody, { marginTop: topInset + 44 }]}>
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Total Balance</Text>
          <View style={styles.balanceRow}>
            <Text style={styles.balanceValue}>₹{balance}</Text>
            <View style={styles.coinTag}>
              <Icon name="award" size={11} color="#FFFFFF" />
              <Text style={styles.coinTagText}>{coins} coins</Text>
            </View>
          </View>
        </View>

        <View style={styles.heroCtaRow}>
          <TouchableOpacity activeOpacity={0.9} onPress={onAddMoney} style={styles.addMoneyBtn}>
            <Icon name="plus" size={16} color={WAVE_BLUE} />
            <Text style={styles.addMoneyText}>Add Money</Text>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.85} onPress={onRedeem} style={styles.redeemBtn}>
            <Text style={styles.redeemText}>Redeem Coins</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  heroWrap: {
    position: 'relative',
    overflow: 'hidden',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    backgroundColor: WAVE_BLUE,
  },
  heroTopRow: {
    position: 'absolute',
    left: SPACING.l,
    right: SPACING.l,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.round,
    backgroundColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: INK,
  },
  heroBody: {
    paddingBottom: SPACING.m,
  },
  balanceCard: {
    marginHorizontal: SPACING.l,
    backgroundColor: GLASS_BG,
    borderRadius: RADIUS.m,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    paddingHorizontal: SPACING.l,
    paddingVertical: SPACING.s,
  },
  balanceLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: SPACING.s,
  },
  balanceValue: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  coinTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: RADIUS.round,
    paddingHorizontal: SPACING.s,
    paddingVertical: 4,
    gap: 4,
  },
  coinTagText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  heroCtaRow: {
    flexDirection: 'row',
    marginTop: SPACING.s,
    marginHorizontal: SPACING.l,
    gap: SPACING.m,
  },
  addMoneyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.round,
    paddingVertical: SPACING.s,
    flex: 1,
    gap: 6,
  },
  addMoneyText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: WAVE_BLUE,
  },
  redeemBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GLASS_BG,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    borderRadius: RADIUS.round,
    paddingVertical: SPACING.s,
    flex: 1,
  },
  redeemText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

export default WalletHeroCard;
