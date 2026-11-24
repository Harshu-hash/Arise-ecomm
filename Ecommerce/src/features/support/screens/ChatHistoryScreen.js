import React from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../../constants/colors';
import { SPACING, RADIUS } from '../../../constants/spacing';
import { StatusBarManager } from '../../../shared/components';
import FullScreenLoader from '../../../shared/loaders/FullScreenLoader';
import ErrorState from '../../../shared/ErrorState/ErrorState';
import { useGetChatHistoryQuery } from '../api/support.api';

// Every chat the customer has had with support, newest first. Ended chats open as read-only transcripts.
const ChatHistoryScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets(),
    query = useGetChatHistoryQuery();
  if (query.isLoading) return <FullScreenLoader message="Loading chats..." />;
  if (query.error)
    return <ErrorState title="Chats unavailable" message={query.error.message} onRetry={query.refetch} />;
  return (
    <View style={styles.container}>
      <StatusBarManager barStyle="dark-content" themeColor={COLORS.surface} />
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity onPress={navigation.goBack}>
          <Icon name="arrow-left" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Your chats</Text>
      </View>
      <FlatList
        data={query.data.items}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>You have not chatted with us yet.</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
            onPress={() =>
              item.status === 'OPEN'
                ? navigation.navigate('Chat')
                : navigation.navigate('Chat', { chatId: item.id })
            }
          >
            <View style={styles.grow}>
              <Text style={styles.preview} numberOfLines={1}>
                {item.lastMessagePreview}
              </Text>
              <Text style={styles.meta}>
                {item.date} · {item.status === 'OPEN' ? 'Ongoing' : 'Ended'}
              </Text>
            </View>
            {item.unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{item.unreadCount}</Text>
              </View>
            )}
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
  headerTitle: { fontSize: 19, fontWeight: '600', color: COLORS.textPrimary },
  list: { paddingHorizontal: SPACING.l, paddingBottom: SPACING.xxxl },
  empty: { textAlign: 'center', color: COLORS.textSecondary, padding: SPACING.xl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.m,
    paddingVertical: SPACING.m,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  grow: { flex: 1 },
  preview: { fontSize: 13.5, fontWeight: '600', color: COLORS.textPrimary },
  meta: { fontSize: 11.5, color: COLORS.textSecondary, marginTop: 2 },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: RADIUS.round,
    paddingHorizontal: 6,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 11, fontWeight: '700', color: COLORS.white },
});
export default ChatHistoryScreen;
