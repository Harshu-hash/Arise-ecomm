import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../../constants/colors';
import { SPACING, RADIUS } from '../../../constants/spacing';
import { StatusBarManager } from '../../../shared/components';

const REVIEWS = [
  {
    id: 'r1',
    product: 'boAt Airdopes 141 Bluetooth Truly Wireless Earbuds',
    rating: 5,
    date: '12 Aug 2026',
    text: 'Great sound quality and battery backup. Worth the price, very comfortable for daily use.',
    helpful: 24,
    thumb: 'headphones',
  },
  {
    id: 'r2',
    product: 'Samsung Galaxy M14 5G (ICY Silver, 128 GB)',
    rating: 4,
    date: '02 Jul 2026',
    text: 'Good performance for the price. Camera could be better in low light but overall satisfied.',
    helpful: 11,
    thumb: 'smartphone',
  },
];

const Stars = ({ count }) => (
  <View style={styles.starsRow}>
    {Array.from({ length: 5 }).map((_, i) => (
      <Icon
        key={i}
        name="star"
        size={13}
        color={i < count ? COLORS.ratingGreen : COLORS.border}
        style={{ marginRight: 2 }}
      />
    ))}
  </View>
);

const ReviewsScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <StatusBarManager barStyle="dark-content" themeColor={COLORS.surface} />

      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity onPress={() => navigation && navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Reviews</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {REVIEWS.map((review) => (
          <View key={review.id} style={styles.card}>
            <View style={styles.cardTopRow}>
              <View style={styles.thumbBox}>
                <Icon name={review.thumb} size={20} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.productName} numberOfLines={2}>{review.product}</Text>
                <Stars count={review.rating} />
              </View>
            </View>

            <Text style={styles.reviewText}>{review.text}</Text>

            <View style={styles.cardBottomRow}>
              <Text style={styles.dateText}>{review.date}</Text>
              <View style={styles.helpfulRow}>
                <Icon name="thumbs-up" size={12} color={COLORS.textTertiary} />
                <Text style={styles.helpfulText}>{review.helpful} found this helpful</Text>
              </View>
            </View>

            <View style={styles.actionsRow}>
              <TouchableOpacity
                activeOpacity={0.7}
                style={styles.actionBtn}
                onPress={() => navigation && navigation.navigate('WriteReview', { review })}>
                <Icon name="edit-2" size={13} color={COLORS.primary} />
                <Text style={styles.actionText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.7} style={styles.actionBtn}>
                <Icon name="trash-2" size={13} color={COLORS.error} />
                <Text style={[styles.actionText, { color: COLORS.error }]}>Delete</Text>
              </TouchableOpacity>
            </View>
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
  card: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.m,
    padding: SPACING.l,
    marginBottom: SPACING.l,
  },
  cardTopRow: {
    flexDirection: 'row',
    marginBottom: SPACING.m,
  },
  thumbBox: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.s,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.m,
  },
  productName: {
    fontSize: 13.5,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  starsRow: {
    flexDirection: 'row',
  },
  reviewText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginBottom: SPACING.m,
  },
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateText: {
    fontSize: 11.5,
    color: COLORS.textTertiary,
  },
  helpfulRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  helpfulText: {
    fontSize: 11.5,
    color: COLORS.textTertiary,
  },
  actionsRow: {
    flexDirection: 'row',
    marginTop: SPACING.m,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: SPACING.m,
    gap: SPACING.xl,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: COLORS.primary,
  },
});

export default ReviewsScreen;
