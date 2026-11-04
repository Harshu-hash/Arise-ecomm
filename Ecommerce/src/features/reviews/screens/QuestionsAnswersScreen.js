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
  useCreateQuestionMutation,
  useGetMyQuestionsQuery,
  useGetProductQuestionsQuery,
} from '../api/reviews.api';

const QuestionsAnswersScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets(),
    toast = useToast(),
    productId = route?.params?.productId,
    productName = route?.params?.productName;
  const mine = useGetMyQuestionsQuery({ limit: 20 }, { skip: !!productId }),
    product = useGetProductQuestionsQuery({ productId, limit: 20 }, { skip: !productId }),
    query = productId ? product : mine;
  const [text, setText] = useState('');
  const [createQuestion, { isLoading: isCreating }] = useCreateQuestionMutation();
  const submit = async () => {
    try {
      const created = await createQuestion({ productId, body: text }).unwrap();
      setText('');
      toast.show('Question submitted for moderation', { variant: 'success', icon: 'check' });
      navigation.navigate('QuestionDetail', { questionId: created.id });
    } catch (error) {
      toast.show(error.message || 'Could not submit question', { variant: 'error' });
    }
  };
  if (query.isLoading) return <FullScreenLoader message="Loading questions..." />;
  if (query.error)
    return (
      <ErrorState
        title="Could not load questions"
        message={query.error.message}
        onRetry={query.refetch}
      />
    );
  const questions = query.data?.items || [];
  return (
    <View style={styles.container}>
      <StatusBarManager barStyle="dark-content" themeColor={COLORS.surface} />
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity onPress={navigation.goBack}>
          <Icon name="arrow-left" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={styles.grow}>
          <Text style={styles.headerTitle}>{productId ? 'Product Questions' : 'My Questions'}</Text>
          {productName ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {productName}
            </Text>
          ) : null}
        </View>
      </View>
      {productId ? (
        <View style={styles.ask}>
          <TextInput
            value={text}
            onChangeText={setText}
            maxLength={500}
            placeholder="Ask about this product"
            placeholderTextColor={COLORS.textTertiary}
            style={styles.input}
          />
          <TouchableOpacity
            disabled={text.trim().length < 5 || isCreating}
            onPress={submit}
            style={[styles.send, (text.trim().length < 5 || isCreating) && styles.disabled]}
          >
            <Icon name="send" size={16} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      ) : null}
      <FlatList
        data={questions}
        keyExtractor={item => item.id}
        contentContainerStyle={questions.length ? styles.list : styles.emptyList}
        refreshControl={<RefreshControl refreshing={query.isFetching} onRefresh={query.refetch} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Icon name="help-circle" size={36} color={COLORS.textTertiary} />
            <Text style={styles.emptyTitle}>No questions yet</Text>
            <Text style={styles.emptyText}>
              {productId
                ? 'Ask the first question about this product.'
                : 'Questions you ask will appear here.'}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('QuestionDetail', { questionId: item.id })}
          >
            <Text style={styles.productName} numberOfLines={1}>
              {item.product}
            </Text>
            <Text style={styles.question}>Q: {item.question}</Text>
            {item.answer ? (
              <Text style={styles.answer} numberOfLines={2}>
                A: {item.answer}
              </Text>
            ) : (
              <Text style={styles.pending}>
                {item.moderationStatus === 'PENDING' ? 'Pending moderation' : 'Awaiting answers'}
              </Text>
            )}
            <View style={styles.meta}>
              <Text style={styles.metaText}>{item.date}</Text>
              <Text style={styles.count}>
                {item.answersCount} {item.answersCount === 1 ? 'answer' : 'answers'}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />
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
  grow: { flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: '600', color: COLORS.textPrimary },
  subtitle: { fontSize: 11, color: COLORS.textTertiary },
  ask: {
    flexDirection: 'row',
    gap: SPACING.s,
    padding: SPACING.m,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
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
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { backgroundColor: COLORS.border },
  list: { padding: SPACING.l, paddingBottom: SPACING.xxxl },
  emptyList: { flexGrow: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary, marginTop: SPACING.m },
  emptyText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.s,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.m,
    padding: SPACING.l,
    marginBottom: SPACING.m,
  },
  productName: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textTertiary,
    textTransform: 'uppercase',
    marginBottom: SPACING.s,
  },
  question: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary, lineHeight: 20 },
  answer: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 19, marginTop: SPACING.s },
  pending: { fontSize: 12, color: COLORS.textTertiary, marginTop: SPACING.s },
  meta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: SPACING.m,
    marginTop: SPACING.m,
  },
  metaText: { fontSize: 11, color: COLORS.textTertiary },
  count: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
});
export default QuestionsAnswersScreen;
