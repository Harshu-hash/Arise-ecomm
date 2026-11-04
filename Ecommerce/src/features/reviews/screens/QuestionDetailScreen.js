import React, { useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../../constants/colors';
import { SPACING, RADIUS } from '../../../constants/spacing';
import { StatusBarManager } from '../../../shared/components';
import FullScreenLoader from '../../../shared/loaders/FullScreenLoader';
import ErrorState from '../../../shared/ErrorState/ErrorState';
import { useToast } from '../../../contexts/ToastContext';
import {
  useCreateAnswerMutation,
  useGetQuestionQuery,
  useMarkAnswerHelpfulMutation,
} from '../api/reviews.api';
const QuestionDetailScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets(),
    toast = useToast(),
    questionId = route?.params?.questionId || route?.params?.question?.id;
  const query = useGetQuestionQuery(questionId, { skip: !questionId });
  const [body, setBody] = useState('');
  const [createAnswer, { isLoading: isSending }] = useCreateAnswerMutation();
  const [markHelpful] = useMarkAnswerHelpfulMutation();
  const send = async () => {
    try {
      await createAnswer({ questionId, body }).unwrap();
      setBody('');
      toast.show('Answer submitted for moderation', { variant: 'success', icon: 'check' });
    } catch (error) {
      toast.show(error.message || 'Could not submit answer', { variant: 'error' });
    }
  };
  const toggle = answer =>
    markHelpful({ questionId, answerId: answer.id, helpful: !answer.viewerFoundHelpful });
  if (query.isLoading) return <FullScreenLoader message="Loading answers..." />;
  if (query.error || !query.data)
    return (
      <ErrorState
        title="Question not found"
        message={query.error?.message}
        onRetry={query.refetch}
      />
    );
  const question = query.data;
  return (
    <View style={styles.container}>
      <StatusBarManager barStyle="dark-content" themeColor={COLORS.surface} />
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity onPress={navigation.goBack}>
          <Icon name="arrow-left" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Question Detail</Text>
      </View>
      <FlatList
        data={question.answers}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={query.isFetching} onRefresh={query.refetch} />}
        ListHeaderComponent={
          <View>
            <Text style={styles.product}>{question.product}</Text>
            <View style={styles.questionCard}>
              <Text style={styles.question}>{question.question}</Text>
              <Text style={styles.askedBy}>
                Asked by {question.authorDisplayName} · {question.date}
              </Text>
            </View>
            <Text style={styles.section}>Answers ({question.answersCount})</Text>
          </View>
        }
        ListEmptyComponent={<Text style={styles.empty}>No published answers yet.</Text>}
        renderItem={({ item }) => (
          <View style={styles.answerCard}>
            <View style={styles.authorRow}>
              <Text style={styles.author}>{item.author}</Text>
              <Text style={styles.type}>{item.authorType}</Text>
            </View>
            <Text style={styles.answer}>{item.text}</Text>
            {item.moderationStatus !== 'PUBLISHED' ? (
              <Text style={styles.pending}>Pending moderation</Text>
            ) : null}
            <View style={styles.answerMeta}>
              <Text style={styles.date}>{item.date}</Text>
              <TouchableOpacity onPress={() => toggle(item)} style={styles.helpful}>
                <Icon
                  name="thumbs-up"
                  size={13}
                  color={item.viewerFoundHelpful ? COLORS.primary : COLORS.textTertiary}
                />
                <Text style={[styles.date, item.viewerFoundHelpful && styles.active]}>
                  {item.helpfulCount} helpful
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, SPACING.l) }]}>
        <TextInput
          value={body}
          onChangeText={setBody}
          maxLength={2000}
          placeholder="Write an answer..."
          placeholderTextColor={COLORS.textTertiary}
          style={styles.input}
        />
        <TouchableOpacity
          disabled={body.trim().length < 2 || isSending}
          onPress={send}
          style={[styles.send, (body.trim().length < 2 || isSending) && styles.disabled]}
        >
          <Icon name="send" size={17} color={COLORS.white} />
        </TouchableOpacity>
      </View>
    </View>
  );
};
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.m,
    paddingHorizontal: SPACING.l,
    paddingBottom: SPACING.m,
    backgroundColor: COLORS.surface,
  },
  headerTitle: { fontSize: 19, fontWeight: '600', color: COLORS.textPrimary },
  list: { padding: SPACING.l, paddingBottom: SPACING.xxxl },
  product: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textTertiary,
    textTransform: 'uppercase',
    marginBottom: SPACING.m,
  },
  questionCard: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.m,
    padding: SPACING.l,
    marginBottom: SPACING.xl,
  },
  question: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, lineHeight: 21 },
  askedBy: { fontSize: 11, color: COLORS.textTertiary, marginTop: SPACING.m },
  section: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.m },
  empty: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', padding: SPACING.xl },
  answerCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.s,
    padding: SPACING.m,
    marginBottom: SPACING.m,
  },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.s },
  author: { fontSize: 12.5, fontWeight: '700', color: COLORS.textPrimary },
  type: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: RADIUS.xs,
  },
  answer: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 19, marginTop: SPACING.s },
  pending: { fontSize: 11, color: COLORS.textTertiary, marginTop: SPACING.s },
  answerMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: SPACING.m },
  date: { fontSize: 11, color: COLORS.textTertiary },
  helpful: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  active: { color: COLORS.primary, fontWeight: '700' },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.s,
    paddingHorizontal: SPACING.l,
    paddingTop: SPACING.m,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.round,
    paddingHorizontal: SPACING.l,
    color: COLORS.textPrimary,
  },
  send: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { backgroundColor: COLORS.border },
});
export default QuestionDetailScreen;
