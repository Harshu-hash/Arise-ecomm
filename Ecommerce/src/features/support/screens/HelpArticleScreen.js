import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../../constants/colors';
import { SPACING, RADIUS } from '../../../constants/spacing';
import { StatusBarManager } from '../../../shared/components';
import { HELP_CATEGORIES } from '../constants/helpData';

const HelpArticleScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { articleId, categoryId } = route?.params || {};
  const category = HELP_CATEGORIES.find((c) => c.id === categoryId) || HELP_CATEGORIES[0];
  const article = category.articles.find((a) => a.id === articleId) || category.articles[0];

  const [feedback, setFeedback] = useState(null);

  return (
    <View style={styles.container}>
      <StatusBarManager barStyle="dark-content" themeColor={COLORS.surface} />

      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity onPress={() => navigation && navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{category.title}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.question}>{article.question}</Text>
        <Text style={styles.answer}>{article.answer}</Text>

        <View style={styles.feedbackCard}>
          <Text style={styles.feedbackTitle}>Was this article helpful?</Text>
          {feedback ? (
            <Text style={styles.feedbackThanks}>
              {feedback === 'yes' ? 'Glad we could help! 🎉' : 'Thanks for letting us know — try the options below.'}
            </Text>
          ) : (
            <View style={styles.feedbackBtnRow}>
              <TouchableOpacity activeOpacity={0.8} style={styles.feedbackBtn} onPress={() => setFeedback('yes')}>
                <Icon name="thumbs-up" size={15} color={COLORS.primary} />
                <Text style={styles.feedbackBtnText}>Yes</Text>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.8} style={styles.feedbackBtn} onPress={() => setFeedback('no')}>
                <Icon name="thumbs-down" size={15} color={COLORS.primary} />
                <Text style={styles.feedbackBtnText}>No</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.divider} />

        <View style={styles.contactCard}>
          <Icon name="life-buoy" size={20} color={COLORS.primary} />
          <Text style={styles.contactTitle}>Still need help?</Text>
          <Text style={styles.contactSubtitle}>
            Chat with our support team or raise a ticket for a detailed follow-up.
          </Text>
          <View style={styles.contactBtnRow}>
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.chatBtn}
              onPress={() => navigation && navigation.navigate('LiveChat', {})}>
              <Icon name="message-circle" size={14} color={COLORS.white} />
              <Text style={styles.chatBtnText}>Chat with us</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.ticketBtn}
              onPress={() => navigation && navigation.navigate('RaiseTicket', {})}>
              <Icon name="file-text" size={14} color={COLORS.primary} />
              <Text style={styles.ticketBtnText}>Raise a Ticket</Text>
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
    flex: 1,
    fontSize: 18,
    fontWeight: '500',
    color: COLORS.textPrimary,
  },
  scrollContent: {
    paddingHorizontal: SPACING.l,
    paddingTop: SPACING.l,
    paddingBottom: SPACING.xxxl,
  },
  question: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    lineHeight: 24,
    marginBottom: SPACING.m,
  },
  answer: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 21,
    marginBottom: SPACING.xl,
  },
  feedbackCard: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.m,
    padding: SPACING.l,
    alignItems: 'center',
  },
  feedbackTitle: {
    fontSize: 13.5,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: SPACING.m,
  },
  feedbackBtnRow: {
    flexDirection: 'row',
    gap: SPACING.m,
  },
  feedbackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: RADIUS.round,
    paddingHorizontal: SPACING.l,
    paddingVertical: SPACING.s,
    gap: 6,
  },
  feedbackBtnText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: COLORS.primary,
  },
  feedbackThanks: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.xl,
  },
  contactCard: {
    alignItems: 'center',
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.m,
    padding: SPACING.xl,
  },
  contactTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: SPACING.s,
    marginBottom: 4,
  },
  contactSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 17,
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
    gap: 6,
  },
  chatBtnText: {
    color: COLORS.white,
    fontSize: 12.5,
    fontWeight: '700',
  },
  ticketBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: RADIUS.s,
    paddingVertical: SPACING.m,
    gap: 6,
  },
  ticketBtnText: {
    color: COLORS.primary,
    fontSize: 12.5,
    fontWeight: '700',
  },
});

export default HelpArticleScreen;
