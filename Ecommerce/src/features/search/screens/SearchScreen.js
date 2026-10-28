import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../../constants/colors';
import { SPACING, RADIUS } from '../../../constants/spacing';
import { GradientBackground, StatusBarManager } from '../../../shared/components';
import {
  TRENDING_SEARCHES,
  SEARCH_SUGGESTIONS,
  ASK_AI_SUGGESTIONS,
  RECENT_SEARCHES_SEED,
} from '../constants/searchData';

const HighlightedText = ({ text, query }) => {
  const idx = query ? text.toLowerCase().indexOf(query.toLowerCase()) : -1;
  if (idx === -1) {
    return <Text style={styles.suggestionText} numberOfLines={1}>{text}</Text>;
  }
  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + query.length);
  const after = text.slice(idx + query.length);
  return (
    <Text style={styles.suggestionText} numberOfLines={1}>
      <Text style={styles.suggestionMatch}>{before}{match}</Text>
      {after}
    </Text>
  );
};

const SearchScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState(route?.params?.initialQuery || '');
  const [recentSearches, setRecentSearches] = useState(RECENT_SEARCHES_SEED);

  const filteredSuggestions = query.trim()
    ? SEARCH_SUGGESTIONS.filter((s) => s.text.toLowerCase().includes(query.trim().toLowerCase()))
    : SEARCH_SUGGESTIONS;

  const runSearch = (text) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setRecentSearches((prev) => [trimmed, ...prev.filter((r) => r.toLowerCase() !== trimmed.toLowerCase())].slice(0, 8));
    navigation && navigation.navigate('SearchResults', { query: trimmed });
  };

  const handleSuggestionPress = (item) => runSearch(item.text);

  return (
    <View style={styles.container}>
      <StatusBarManager barStyle="dark-content" themeColor={COLORS.primaryLight} />

      {/* Search Header Bar */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity
          onPress={() => navigation && navigation.goBack()}
          style={styles.backBtn}>
          <Icon name="arrow-left" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>

        <View style={styles.searchInputBox}>
          <Icon name="search" size={18} color={COLORS.textSecondary} style={{ marginRight: SPACING.s }} />
          <TextInput
            autoFocus
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => runSearch(query)}
            returnKeyType="search"
            placeholder="Search for items..."
            placeholderTextColor={COLORS.textSecondary}
            style={styles.input}
          />
          {query.length > 0 ? (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Icon name="x" size={18} color={COLORS.textPrimary} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {query.trim().length === 0 ? (
        /* Default Search State: Recent + Trending Searches */
        <View style={styles.trendingContainer}>
          {recentSearches.length > 0 ? (
            <View style={{ marginBottom: SPACING.xl }}>
              <View style={styles.trendingHeader}>
                <Icon name="clock" size={16} color={COLORS.textSecondary} style={{ marginRight: SPACING.s }} />
                <Text style={styles.trendingTitle}>Recent Searches</Text>
              </View>
              <View style={styles.chipsContainer}>
                {recentSearches.map((item) => (
                  <TouchableOpacity
                    key={item}
                    activeOpacity={0.8}
                    onPress={() => runSearch(item)}
                    style={styles.trendingChip}>
                    <Icon name="clock" size={12} color={COLORS.textSecondary} style={{ marginRight: 6 }} />
                    <Text style={styles.chipText}>{item}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : null}

          <View style={styles.trendingHeader}>
            <Icon name="trending-up" size={18} color={COLORS.primary} style={{ marginRight: SPACING.s }} />
            <Text style={styles.trendingTitle}>Trending Searches</Text>
          </View>

          <View style={styles.chipsContainer}>
            {TRENDING_SEARCHES.map((item) => (
              <TouchableOpacity
                key={item}
                activeOpacity={0.8}
                onPress={() => runSearch(item)}
                style={styles.trendingChip}>
                <Icon name="search" size={12} color={COLORS.textSecondary} style={{ marginRight: 6 }} />
                <Text style={styles.chipText}>{item}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : (
        /* Autocomplete Suggestions */
        <FlatList
          data={filteredSuggestions}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => runSearch(query)}
              style={styles.searchForRow}>
              <Icon name="search" size={16} color={COLORS.textSecondary} />
              <Text style={styles.searchForText}>
                Search for <Text style={styles.searchForQuery}>"{query}"</Text>
              </Text>
            </TouchableOpacity>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => handleSuggestionPress(item)}
              style={styles.suggestionRow}>
              <Image source={{ uri: item.image }} style={styles.suggestionThumb} resizeMode="cover" />

              <View style={styles.suggestionTextBlock}>
                <HighlightedText text={item.text} query={query} />
                {item.category ? (
                  <Text
                    style={[
                      styles.suggestionCategory,
                      item.type === 'chevron' && styles.suggestionCategoryPlain,
                    ]}
                    numberOfLines={1}>
                    {item.category}
                  </Text>
                ) : null}
              </View>

              <Icon
                name={item.type === 'chevron' ? 'chevron-right' : 'arrow-up-left'}
                size={16}
                color={item.type === 'chevron' ? COLORS.textSecondary : COLORS.textTertiary}
              />
            </TouchableOpacity>
          )}
          ListFooterComponent={
            <View style={styles.askAiSection}>
              <View style={styles.askAiHeader}>
                <Text style={styles.askAiIcon}>✨</Text>
                <Text style={styles.askAiTitle}>Ask AI</Text>
              </View>

              <View style={styles.askAiChips}>
                {ASK_AI_SUGGESTIONS.map((suggestion) => (
                  <TouchableOpacity
                    key={suggestion}
                    activeOpacity={0.8}
                    onPress={() => runSearch(suggestion)}
                    style={styles.aiPillOuter}>
                    <GradientBackground colors={['#B133F0', '#E91E8C']} id="ai_pill_border" />
                    <View style={styles.aiPillInner}>
                      <Text style={styles.aiPillText}>{suggestion}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          }
        />
      )}
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
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: SPACING.l,
    paddingBottom: SPACING.m,
  },
  backBtn: {
    marginRight: SPACING.s,
    padding: 4,
  },
  searchInputBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.round,
    paddingHorizontal: SPACING.m,
    height: 44,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: COLORS.textPrimary,
    fontWeight: '400',
  },
  trendingContainer: {
    padding: SPACING.l,
  },
  trendingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.m,
  },
  trendingTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.s,
  },
  trendingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.m,
    paddingVertical: 8,
    borderRadius: RADIUS.round,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  searchForRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.l,
    paddingVertical: SPACING.m,
    gap: SPACING.m,
    backgroundColor: COLORS.mutedBg,
  },
  searchForText: {
    fontSize: 13.5,
    color: COLORS.textSecondary,
  },
  searchForQuery: {
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.l,
    paddingVertical: SPACING.m,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
    gap: SPACING.m,
  },
  suggestionThumb: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.xs,
    backgroundColor: COLORS.mutedBg,
  },
  suggestionTextBlock: {
    flex: 1,
  },
  suggestionText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  suggestionMatch: {
    fontWeight: '400',
    color: COLORS.textSecondary,
  },
  suggestionCategory: {
    fontSize: 12,
    color: COLORS.primary,
    marginTop: 2,
  },
  suggestionCategoryPlain: {
    color: COLORS.textSecondary,
  },
  askAiSection: {
    backgroundColor: COLORS.mutedBg,
    paddingHorizontal: SPACING.l,
    paddingVertical: SPACING.l,
    marginTop: SPACING.s,
  },
  askAiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.s,
    marginBottom: SPACING.m,
  },
  askAiIcon: {
    fontSize: 18,
  },
  askAiTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  askAiChips: {
    gap: SPACING.s,
  },
  aiPillOuter: {
    alignSelf: 'flex-start',
    borderRadius: RADIUS.round,
    padding: 1.5,
    overflow: 'hidden',
  },
  aiPillInner: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.round,
    paddingHorizontal: SPACING.l,
    paddingVertical: 10,
  },
  aiPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
});

export default SearchScreen;
