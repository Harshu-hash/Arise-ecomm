import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../../constants/colors';
import { SPACING, RADIUS } from '../../../constants/spacing';
import { StatusBarManager } from '../../../shared/components';
import FullScreenLoader from '../../../shared/loaders/FullScreenLoader';
import ErrorState from '../../../shared/ErrorState/ErrorState';
import { useGetHelpArticleQuery, useSubmitArticleFeedbackMutation } from '../api/support.api';
const HelpArticleScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets(),
    articleId = route?.params?.articleId,
    query = useGetHelpArticleQuery(articleId, { skip: !articleId }),
    [feedback, { isLoading }] = useSubmitArticleFeedbackMutation();
  if (query.isLoading) return <FullScreenLoader message="Loading article..." />;
  if (query.error || !query.data)
    return (
      <ErrorState
        title="Article not found"
        message={query.error?.message}
        onRetry={query.refetch}
      />
    );
  const article = query.data;
  return (
    <View style={styles.container}>
      <StatusBarManager barStyle="dark-content" themeColor={COLORS.surface} />
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity onPress={navigation.goBack}>
          <Icon name="arrow-left" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help Article</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{article.title}</Text>
        <Text style={styles.version}>
          Version {article.version} · Published{' '}
          {new Date(article.publishedAt).toLocaleDateString('en-IN')}
        </Text>
        <Text style={styles.body}>{article.body}</Text>
        <View style={styles.feedback}>
          <Text style={styles.feedbackTitle}>Was this article helpful?</Text>
          {article.viewerFeedback ? (
            <Text style={styles.thanks}>Thanks for your feedback.</Text>
          ) : (
            <View style={styles.buttons}>
              <TouchableOpacity
                disabled={isLoading}
                onPress={() => feedback({ articleId, helpful: true })}
                style={styles.feedbackButton}
              >
                <Icon name="thumbs-up" size={15} color={COLORS.primary} />
                <Text style={styles.feedbackText}>Yes</Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={isLoading}
                onPress={() => feedback({ articleId, helpful: false })}
                style={styles.feedbackButton}
              >
                <Icon name="thumbs-down" size={15} color={COLORS.primary} />
                <Text style={styles.feedbackText}>No</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
        <TouchableOpacity
          onPress={() => navigation.navigate('RaiseTicket', {})}
          style={styles.ticket}
        >
          <Text style={styles.ticketText}>Still need help? Raise a Ticket</Text>
        </TouchableOpacity>
      </ScrollView>
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
  headerTitle: { fontSize: 18, fontWeight: '600', color: COLORS.textPrimary },
  content: { padding: SPACING.l },
  title: { fontSize: 19, fontWeight: '700', color: COLORS.textPrimary, lineHeight: 25 },
  version: { fontSize: 10.5, color: COLORS.textTertiary, marginTop: SPACING.s },
  body: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 22, marginTop: SPACING.xl },
  feedback: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.m,
    padding: SPACING.l,
    marginTop: SPACING.xl,
  },
  feedbackTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  buttons: { flexDirection: 'row', justifyContent: 'center', gap: SPACING.l, marginTop: SPACING.m },
  feedbackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.s,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: RADIUS.round,
    paddingHorizontal: SPACING.l,
    paddingVertical: SPACING.s,
  },
  feedbackText: { fontSize: 12.5, fontWeight: '700', color: COLORS.primary },
  thanks: { fontSize: 12.5, color: COLORS.ratingGreen, textAlign: 'center', marginTop: SPACING.m },
  ticket: {
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: RADIUS.s,
    padding: SPACING.m,
    alignItems: 'center',
    marginTop: SPACING.xl,
  },
  ticketText: { fontWeight: '700', color: COLORS.primary },
});
export default HelpArticleScreen;
