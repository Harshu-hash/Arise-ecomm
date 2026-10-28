import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { COLORS } from '../../../constants/colors';
import { SPACING, RADIUS } from '../../../constants/spacing';

const WalletRewardsSection = ({ title, cards, onPressCard }) => (
  <>
    <Text style={styles.sectionTitle}>{title}</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rewardRow}>
      {cards.map((card) => (
        <TouchableOpacity
          key={card.id}
          activeOpacity={0.85}
          onPress={() => onPressCard && onPressCard(card)}
          style={[styles.rewardCard, { backgroundColor: card.bg }]}>
          <Text style={styles.rewardEmoji}>{card.emoji}</Text>
          <Text style={styles.rewardTitle}>{card.title}</Text>
          <Text style={[styles.rewardSubtitle, { color: card.accent }]}>{card.subtitle}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  </>
);

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    paddingHorizontal: SPACING.l,
    marginTop: SPACING.xl,
    marginBottom: SPACING.s,
  },
  rewardRow: {
    paddingHorizontal: SPACING.l,
    gap: SPACING.m,
  },
  rewardCard: {
    width: 140,
    borderRadius: RADIUS.m,
    padding: SPACING.m,
  },
  rewardEmoji: {
    fontSize: 24,
  },
  rewardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: SPACING.s,
  },
  rewardSubtitle: {
    fontSize: 11.5,
    fontWeight: '600',
    marginTop: 2,
  },
});

export default WalletRewardsSection;
