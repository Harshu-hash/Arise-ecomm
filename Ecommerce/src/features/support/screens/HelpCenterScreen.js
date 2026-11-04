import React, { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../../constants/colors';
import { SPACING, RADIUS } from '../../../constants/spacing';
import { StatusBarManager } from '../../../shared/components';
import FullScreenLoader from '../../../shared/loaders/FullScreenLoader';
import ErrorState from '../../../shared/ErrorState/ErrorState';
import { useGetHelpCategoriesQuery, useLazySearchHelpQuery } from '../api/support.api';
const HelpCenterScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets(),
    categories = useGetHelpCategoriesQuery(),
    [search, { data: results, isFetching }] = useLazySearchHelpQuery(),
    [query, setQuery] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim().length >= 2) search(query.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [query, search]);
  if (categories.isLoading) return <FullScreenLoader message="Loading Help Center..." />;
  if (categories.error)
    return (
      <ErrorState
        title="Help Center unavailable"
        message={categories.error.message}
        onRetry={categories.refetch}
      />
    );
  const searching = query.trim().length >= 2;
  return (
    <View style={styles.container}>
      <StatusBarManager barStyle="dark-content" themeColor={COLORS.surface} />
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity onPress={navigation.goBack}>
          <Icon name="arrow-left" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help Center</Text>
      </View>
      <View style={styles.search}>
        <Icon name="search" size={16} color={COLORS.textTertiary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search help articles"
          placeholderTextColor={COLORS.textTertiary}
          style={styles.input}
        />
      </View>
      {searching ? (
        <FlatList
          data={results?.items || []}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            isFetching ? (
              <Text style={styles.empty}>Searching...</Text>
            ) : (
              <Text style={styles.empty}>No matching help articles.</Text>
            )
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.article}
              onPress={() => navigation.navigate('HelpArticle', { articleId: item.id })}
            >
              <View style={styles.grow}>
                <Text style={styles.articleTitle}>{item.title}</Text>
                <Text style={styles.articleSummary}>{item.summary}</Text>
              </View>
              <Icon name="chevron-right" size={16} color={COLORS.textTertiary} />
            </TouchableOpacity>
          )}
        />
      ) : (
        <FlatList
          data={categories.data}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View>
              <View style={styles.actions}>
                <TouchableOpacity
                  onPress={() => navigation.navigate('MyTickets')}
                  style={styles.action}
                >
                  <Icon name="clipboard" size={18} color={COLORS.primary} />
                  <Text style={styles.actionText}>My Tickets</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => navigation.navigate('RaiseTicket', {})}
                  style={styles.action}
                >
                  <Icon name="plus-circle" size={18} color={COLORS.primary} />
                  <Text style={styles.actionText}>Raise Ticket</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.section}>Browse Help Topics</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.category}
              onPress={() => navigation.navigate('HelpCategory', { categoryId: item.id })}
            >
              <View style={styles.icon}>
                <Icon name={item.icon} size={18} color={COLORS.primary} />
              </View>
              <View style={styles.grow}>
                <Text style={styles.categoryTitle}>{item.title}</Text>
                <Text style={styles.categorySubtitle}>{item.subtitle}</Text>
              </View>
              <Icon name="chevron-right" size={16} color={COLORS.textTertiary} />
            </TouchableOpacity>
          )}
        />
      )}
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
  headerTitle: { fontSize: 20, fontWeight: '600', color: COLORS.textPrimary },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.s,
    margin: SPACING.l,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.s,
    paddingHorizontal: SPACING.m,
    backgroundColor: COLORS.surface,
  },
  input: { flex: 1, color: COLORS.textPrimary },
  list: { paddingHorizontal: SPACING.l, paddingBottom: SPACING.xxxl },
  actions: { flexDirection: 'row', gap: SPACING.s },
  action: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.s,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: RADIUS.s,
    padding: SPACING.m,
  },
  actionText: { fontSize: 12.5, fontWeight: '700', color: COLORS.primary },
  section: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: SPACING.xl,
    marginBottom: SPACING.s,
  },
  category: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.m,
    paddingVertical: SPACING.m,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grow: { flex: 1 },
  categoryTitle: { fontSize: 13.5, fontWeight: '700', color: COLORS.textPrimary },
  categorySubtitle: { fontSize: 11.5, color: COLORS.textSecondary, marginTop: 2 },
  article: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.m,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  articleTitle: { fontSize: 13.5, fontWeight: '700', color: COLORS.textPrimary },
  articleSummary: { fontSize: 11.5, color: COLORS.textSecondary, marginTop: 3 },
  empty: { textAlign: 'center', color: COLORS.textSecondary, padding: SPACING.xl },
});
export default HelpCenterScreen;
