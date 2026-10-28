import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../../constants/colors';
import { SPACING, RADIUS } from '../../../constants/spacing';
import { StatusBarManager } from '../../../shared/components';

const MOCK_ANSWERS = [
  { id: 'a1', author: 'Rohit K.', text: 'Yes, 10 minutes of charging gives around 2 hours of playback.', date: '21 Aug 2026', helpful: 18 },
  { id: 'a2', author: 'Flipkart Seller', text: 'Confirmed, the earbuds support fast charging via USB-C.', date: '22 Aug 2026', helpful: 5 },
];

const QuestionDetailScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const question = route?.params?.question;
  const [answerText, setAnswerText] = useState('');

  return (
    <View style={styles.container}>
      <StatusBarManager barStyle="dark-content" themeColor={COLORS.surface} />

      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity onPress={() => navigation && navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Question Detail</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {question ? (
          <>
            <Text style={styles.productName} numberOfLines={1}>{question.product}</Text>
            <View style={styles.questionCard}>
              <Icon name="help-circle" size={16} color={COLORS.primary} style={{ marginRight: SPACING.s }} />
              <Text style={styles.questionText}>{question.question}</Text>
            </View>
          </>
        ) : null}

        <Text style={styles.sectionTitle}>Answers ({MOCK_ANSWERS.length})</Text>

        {MOCK_ANSWERS.map((answer) => (
          <View key={answer.id} style={styles.answerCard}>
            <Text style={styles.answerAuthor}>{answer.author}</Text>
            <Text style={styles.answerText}>{answer.text}</Text>
            <View style={styles.answerBottomRow}>
              <Text style={styles.answerDate}>{answer.date}</Text>
              <View style={styles.helpfulRow}>
                <Icon name="thumbs-up" size={12} color={COLORS.textTertiary} />
                <Text style={styles.helpfulText}>{answer.helpful}</Text>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, SPACING.l) }]}>
        <TextInput
          style={styles.input}
          value={answerText}
          onChangeText={setAnswerText}
          placeholder="Write your answer..."
          placeholderTextColor={COLORS.textTertiary}
        />
        <TouchableOpacity
          activeOpacity={0.85}
          disabled={!answerText.trim()}
          style={[styles.sendBtn, !answerText.trim() && styles.sendBtnDisabled]}>
          <Icon name="send" size={17} color={COLORS.white} />
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
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textTertiary,
    marginBottom: SPACING.m,
    textTransform: 'uppercase',
  },
  questionCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.m,
    padding: SPACING.l,
    marginBottom: SPACING.xl,
  },
  questionText: {
    flex: 1,
    fontSize: 14.5,
    fontWeight: '600',
    color: COLORS.textPrimary,
    lineHeight: 19,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.m,
  },
  answerCard: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.s,
    padding: SPACING.m,
    marginBottom: SPACING.m,
  },
  answerAuthor: {
    fontSize: 12.5,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  answerText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginBottom: SPACING.s,
  },
  answerBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  answerDate: {
    fontSize: 11,
    color: COLORS.textTertiary,
  },
  helpfulRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  helpfulText: {
    fontSize: 11,
    color: COLORS.textTertiary,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.l,
    paddingTop: SPACING.m,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.surface,
    gap: SPACING.s,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.round,
    paddingHorizontal: SPACING.l,
    paddingVertical: SPACING.s,
    fontSize: 13.5,
    color: COLORS.textPrimary,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: COLORS.border,
  },
});

export default QuestionDetailScreen;
