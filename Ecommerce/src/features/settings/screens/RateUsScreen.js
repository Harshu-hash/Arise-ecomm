import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../../constants/colors';
import { SPACING, RADIUS } from '../../../constants/spacing';
import { StatusBarManager } from '../../../shared/components';

const RateUsScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [rating, setRating] = useState(0);

  return (
    <View style={styles.container}>
      <StatusBarManager barStyle="dark-content" themeColor={COLORS.surface} />

      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity onPress={() => navigation && navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Rate Us</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Icon name="smile" size={34} color={COLORS.primary} />
        </View>
        <Text style={styles.title}>Enjoying Flipkart?</Text>
        <Text style={styles.subtitle}>
          Let us know how we're doing. Your feedback helps us improve your shopping experience.
        </Text>

        <View style={styles.starsRow}>
          {Array.from({ length: 5 }).map((_, i) => (
            <TouchableOpacity key={i} activeOpacity={0.7} onPress={() => setRating(i + 1)}>
              <Icon
                name="star"
                size={34}
                color={i < rating ? COLORS.ctaYellow : COLORS.border}
                style={styles.star}
              />
            </TouchableOpacity>
          ))}
        </View>

        {rating > 0 ? (
          <Text style={styles.ratingFeedback}>
            {rating >= 4 ? 'Awesome! Thanks for the love ❤️' : 'Thanks! We will work on improving.'}
          </Text>
        ) : null}

        <TouchableOpacity
          activeOpacity={0.85}
          disabled={rating === 0}
          style={[styles.submitBtn, rating === 0 && styles.submitBtnDisabled]}>
          <Text style={styles.submitBtnText}>Submit Rating</Text>
        </TouchableOpacity>
      </View>
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
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.huge,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.l,
  },
  title: {
    fontSize: 19,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.s,
  },
  subtitle: {
    fontSize: 13.5,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: SPACING.xxl,
  },
  starsRow: {
    flexDirection: 'row',
    marginBottom: SPACING.l,
  },
  star: {
    marginHorizontal: SPACING.xs,
  },
  ratingFeedback: {
    fontSize: 13.5,
    fontWeight: '600',
    color: COLORS.primary,
    marginBottom: SPACING.xl,
  },
  submitBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.s,
    paddingVertical: SPACING.m,
    paddingHorizontal: SPACING.xxxl,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  submitBtnDisabled: {
    backgroundColor: COLORS.border,
  },
  submitBtnText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '700',
  },
});

export default RateUsScreen;
