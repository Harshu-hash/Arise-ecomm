import React from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../../constants/colors';
import { SPACING, RADIUS } from '../../../constants/spacing';
import { StatusBarManager } from '../../../shared/components';
import FullScreenLoader from '../../../shared/loaders/FullScreenLoader';
import ErrorState from '../../../shared/ErrorState/ErrorState';
import { useGetHelpCategoryQuery } from '../api/support.api';
const HelpCategoryScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets(),
    categoryId = route?.params?.categoryId,
    query = useGetHelpCategoryQuery(categoryId, { skip: !categoryId });
  if (query.isLoading) return <FullScreenLoader message="Loading articles..." />;
  if (query.error || !query.data)
    return (
      <ErrorState
        title="Help category not found"
        message={query.error?.message}
        onRetry={query.refetch}
      />
    );
  const category = query.data;
  return (
    <View style={styles.container}>
      <StatusBarManager barStyle="dark-content" themeColor={COLORS.surface} />
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity onPress={navigation.goBack}>
          <Icon name="arrow-left" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{category.title}</Text>
      </View>
      <FlatList
        data={category.articles}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.banner}>
            <Icon name={category.icon} size={24} color={COLORS.primary} />
            <Text style={styles.subtitle}>{category.subtitle}</Text>
          </View>
        }
        ListFooterComponent={
          <TouchableOpacity
            style={styles.ticket}
            onPress={() => navigation.navigate('RaiseTicket', {})}
          >
            <Text style={styles.ticketText}>Still need help? Raise a Ticket</Text>
          </TouchableOpacity>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
            onPress={() => navigation.navigate('HelpArticle', { articleId: item.id })}
          >
            <View style={styles.grow}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.summary}>{item.summary}</Text>
              <Text style={styles.version}>
                Version {item.version} · {new Date(item.publishedAt).toLocaleDateString('en-IN')}
              </Text>
            </View>
            <Icon name="chevron-right" size={16} color={COLORS.textTertiary} />
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
  headerTitle: { fontSize: 18, fontWeight: '600', color: COLORS.textPrimary, flex: 1 },
  list: { padding: SPACING.l },
  banner: {
    alignItems: 'center',
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.m,
    padding: SPACING.l,
    marginBottom: SPACING.l,
  },
  subtitle: { fontSize: 12.5, color: COLORS.textSecondary, marginTop: SPACING.s },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.m,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  grow: { flex: 1 },
  title: { fontSize: 13.5, fontWeight: '700', color: COLORS.textPrimary },
  summary: { fontSize: 11.5, color: COLORS.textSecondary, lineHeight: 16, marginTop: 3 },
  version: { fontSize: 9.5, color: COLORS.textTertiary, marginTop: 4 },
  ticket: {
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: RADIUS.s,
    padding: SPACING.m,
    alignItems: 'center',
    marginTop: SPACING.xl,
  },
  ticketText: { color: COLORS.primary, fontWeight: '700' },
});
export default HelpCategoryScreen;
