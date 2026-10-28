import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../../constants/colors';
import { SPACING } from '../../../constants/spacing';
import { StatusBarManager } from '../../../shared/components';

/**
 * Placeholder for the "Play" tab — no reference design was provided for this surface,
 * unlike every other screen in this app which is matched to a design_reference/*.jpeg.
 */
const PlayScreen = () => (
  <View style={styles.container}>
    <StatusBarManager barStyle="dark-content" themeColor={COLORS.surface} />
    <Icon name="play-circle" size={48} color={COLORS.textTertiary} />
    <Text style={styles.title}>Play is coming soon</Text>
    <Text style={styles.subtitle}>Videos, quizzes and shoppable content will show up here.</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xxl,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: SPACING.m,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
});

export default PlayScreen;
