import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../../constants/colors';
import { SPACING, RADIUS } from '../../../constants/spacing';
import { HERO_GRADIENT } from '../data/walletData';

const WalletQuickActions = ({ actions, onPressAction }) => (
  <View style={styles.quickGrid}>
    {actions.map((action) => (
      <TouchableOpacity
        key={action.id}
        activeOpacity={0.8}
        onPress={() => onPressAction && onPressAction(action)}
        style={styles.quickItem}>
        <View style={styles.quickIconWrap}>
          <Icon name={action.icon} size={19} color={HERO_GRADIENT[0]} />
        </View>
        <Text style={styles.quickLabel}>{action.label}</Text>
      </TouchableOpacity>
    ))}
  </View>
);

const styles = StyleSheet.create({
  quickGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.l,
    marginTop: SPACING.m,
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.l,
    paddingTop: SPACING.l,
    marginHorizontal: SPACING.l,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
    paddingBottom: SPACING.m,
  },
  quickItem: {
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  quickIconWrap: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.round,
    backgroundColor: '#F3EEFD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLabel: {
    fontSize: 11.5,
    fontWeight: '600',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
});

export default WalletQuickActions;
