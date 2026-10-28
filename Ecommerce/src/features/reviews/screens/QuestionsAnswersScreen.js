import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../../constants/colors';
import { SPACING, RADIUS } from '../../../constants/spacing';
import { StatusBarManager } from '../../../shared/components';

const QUESTIONS = [
  {
    id: 'q1',
    product: 'boAt Airdopes 141 Bluetooth Truly Wireless Earbuds',
    question: 'Does this support fast charging?',
    answer: 'Yes, 10 minutes of charging gives around 2 hours of playback.',
    answersCount: 3,
    date: '20 Aug 2026',
  },
  {
    id: 'q2',
    product: 'Samsung Galaxy M14 5G (ICY Silver, 128 GB)',
    question: 'Is the box a genuine Samsung India warranty unit?',
    answer: null,
    answersCount: 0,
    date: '05 Jul 2026',
  },
];

const QuestionsAnswersScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <StatusBarManager barStyle="dark-content" themeColor={COLORS.surface} />

      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity onPress={() => navigation && navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Questions & Answers</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {QUESTIONS.map((item) => (
          <TouchableOpacity
            key={item.id}
            activeOpacity={0.7}
            style={styles.card}
            onPress={() => navigation && navigation.navigate('QuestionDetail', { question: item })}>
            <Text style={styles.productName} numberOfLines={1}>{item.product}</Text>

            <View style={styles.questionRow}>
              <Icon name="help-circle" size={15} color={COLORS.primary} style={{ marginRight: SPACING.s }} />
              <Text style={styles.questionText}>{item.question}</Text>
            </View>

            {item.answer ? (
              <View style={styles.answerRow}>
                <Icon name="corner-down-right" size={14} color={COLORS.textTertiary} style={{ marginRight: SPACING.s }} />
                <Text style={styles.answerText}>{item.answer}</Text>
              </View>
            ) : (
              <View style={styles.pendingPill}>
                <Text style={styles.pendingText}>Awaiting answers</Text>
              </View>
            )}

            <View style={styles.cardBottomRow}>
              <Text style={styles.dateText}>{item.date}</Text>
              <Text style={styles.answersCountText}>
                {item.answersCount} {item.answersCount === 1 ? 'answer' : 'answers'}
              </Text>
            </View>
          </TouchableOpacity>
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
  productName: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textTertiary,
    marginBottom: SPACING.m,
    textTransform: 'uppercase',
  },
  questionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.s,
  },
  questionText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    lineHeight: 19,
  },
  answerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.m,
  },
  answerText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  pendingPill: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.mutedBg,
    borderRadius: RADIUS.xs,
    paddingHorizontal: SPACING.s,
    paddingVertical: 4,
    marginBottom: SPACING.m,
  },
  pendingText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: SPACING.m,
  },
  dateText: {
    fontSize: 11.5,
    color: COLORS.textTertiary,
  },
  answersCountText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },
});

export default QuestionsAnswersScreen;
