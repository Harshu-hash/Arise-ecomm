import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import Animated, { useSharedValue, useAnimatedStyle, withDelay, withSpring } from 'react-native-reanimated';
import { COLORS } from '../../../constants/colors';
import { SPACING, RADIUS } from '../../../constants/spacing';
import { StatusBarManager } from '../../../shared/components';
import { useToast } from '../../../contexts/ToastContext';
import { haptics } from '../../../utils/haptics';

const Star = ({ filled, index, onPress }) => {
  const scale = useSharedValue(1);

  useEffect(() => {
    if (filled) {
      scale.value = withDelay(
        index * 40,
        withSpring(1.25, { damping: 9, stiffness: 220 }, () => {
          scale.value = withSpring(1, { damping: 12, stiffness: 220 });
        }),
      );
    }
  }, [filled, index, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress}>
      <Animated.View style={animatedStyle}>
        <Icon
          name="star"
          size={30}
          color={filled ? COLORS.ratingGreen : COLORS.border}
          style={styles.star}
        />
      </Animated.View>
    </TouchableOpacity>
  );
};

const WriteReviewScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const review = route?.params?.review;
  const isEdit = !!review;

  const [rating, setRating] = useState(review?.rating || 0);
  const [text, setText] = useState(review?.text || '');

  const handleRate = (value) => {
    haptics.light();
    setRating(value);
  };

  const handleSubmit = () => {
    if (rating === 0) return;
    haptics.success();
    toast.show(isEdit ? 'Review updated' : 'Review submitted', { icon: 'check', variant: 'success' });
    navigation && navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <StatusBarManager barStyle="dark-content" themeColor={COLORS.surface} />

      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity onPress={() => navigation && navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEdit ? 'Edit Review' : 'Write a Review'}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {review ? (
          <Text style={styles.productName} numberOfLines={2}>{review.product}</Text>
        ) : null}

        <Text style={styles.fieldLabel}>Rate this product</Text>
        <View style={styles.starsRow}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} index={i} filled={i < rating} onPress={() => handleRate(i + 1)} />
          ))}
        </View>

        <Text style={styles.fieldLabel}>Your Review</Text>
        <TextInput
          style={styles.textArea}
          value={text}
          onChangeText={setText}
          multiline
          placeholder="Share details about your experience with this product"
          placeholderTextColor={COLORS.textTertiary}
        />
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, SPACING.l) }]}>
        <TouchableOpacity
          activeOpacity={0.85}
          disabled={rating === 0}
          style={[styles.submitBtn, rating === 0 && styles.submitBtnDisabled]}
          onPress={handleSubmit}>
          <Text style={styles.submitBtnText}>{isEdit ? 'Update Review' : 'Submit Review'}</Text>
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
    fontSize: 19,
    fontWeight: '500',
    color: COLORS.textPrimary,
  },
  scrollContent: {
    paddingHorizontal: SPACING.l,
    paddingTop: SPACING.l,
    paddingBottom: SPACING.xxxl,
  },
  productName: {
    fontSize: 13.5,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: SPACING.xl,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.m,
  },
  starsRow: {
    flexDirection: 'row',
    marginBottom: SPACING.xl,
  },
  star: {
    marginRight: SPACING.s,
  },
  textArea: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.s,
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.m,
    fontSize: 14,
    color: COLORS.textPrimary,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  footer: {
    paddingHorizontal: SPACING.l,
    paddingTop: SPACING.m,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  submitBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.s,
    paddingVertical: SPACING.m,
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

export default WriteReviewScreen;
