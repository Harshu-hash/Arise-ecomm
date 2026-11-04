import React from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../../constants/colors';
import { SPACING, RADIUS } from '../../../constants/spacing';
import { StatusBarManager } from '../../../shared/components';
import EmptyState from '../../../shared/EmptyState/EmptyState';
import FullScreenLoader from '../../../shared/loaders/FullScreenLoader';
import ErrorState from '../../../shared/ErrorState/ErrorState';
import {
  useGetNotificationsQuery,
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
} from '../api/notifications.api';
const destination = {
  PRODUCT: item => ['ProductDetail', { productId: item.target.entityId }],
  ORDER: item => ['OrderDetail', { orderId: item.target.entityId }],
  SHIPMENT: item => ['Tracking', { orderId: item.target.entityId }],
  TICKET: item => ['TicketDetail', { ticketId: item.target.entityId }],
};
const NotificationsScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets(),
    query = useGetNotificationsQuery({ limit: 50 }),
    [markRead] = useMarkNotificationReadMutation(),
    [markAll, { isLoading: isMarkingAll }] = useMarkAllNotificationsReadMutation();
  if (query.isLoading) return <FullScreenLoader message="Loading notifications..." />;
  if (query.error)
    return (
      <ErrorState
        title="Could not load notifications"
        message={query.error.message}
        onRetry={query.refetch}
      />
    );
  const items = query.data.items;
  const open = async item => {
    if (!item.read) await markRead(item.id);
    const target = destination[item.target.type]?.(item);
    if (target && item.target.entityId) navigation.navigate(...target);
  };
  return (
    <View style={styles.container}>
      <StatusBarManager barStyle="dark-content" themeColor={COLORS.surface} />
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity
          onPress={() =>
            navigation.canGoBack()
              ? navigation.goBack()
              : navigation.navigate('MainTabs', { screen: 'Home' })
          }
        >
          <Icon name="arrow-left" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <TouchableOpacity onPress={() => navigation.navigate('NotificationPreferences')}>
          <Icon name="settings" size={19} color={COLORS.textPrimary} />
        </TouchableOpacity>
      </View>
      {query.data.unreadCount > 0 ? (
        <View style={styles.toolbar}>
          <Text style={styles.unread}>{query.data.unreadCount} unread</Text>
          <TouchableOpacity disabled={isMarkingAll} onPress={() => markAll()}>
            <Text style={styles.markAll}>{isMarkingAll ? 'Updating...' : 'Mark all read'}</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      <FlatList
        data={items}
        keyExtractor={item => item.id}
        contentContainerStyle={items.length ? styles.list : styles.emptyList}
        refreshControl={<RefreshControl refreshing={query.isFetching} onRefresh={query.refetch} />}
        ListEmptyComponent={
          <EmptyState
            icon="bell"
            title="No notifications yet"
            message="Account notifications will appear here."
          />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => open(item)}
            style={[styles.row, !item.read && styles.unreadRow]}
          >
            <View style={styles.icon}>
              <Icon name={item.icon} size={18} color={COLORS.primary} />
            </View>
            <View style={styles.body}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.message}>{item.message}</Text>
              <Text style={styles.time}>{item.timestamp}</Text>
            </View>
            {!item.read ? <View style={styles.dot} /> : null}
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
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.l,
    paddingBottom: SPACING.m,
    backgroundColor: COLORS.surface,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.l,
    paddingVertical: SPACING.s,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  unread: { fontSize: 12, color: COLORS.textSecondary },
  markAll: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  list: { padding: SPACING.l },
  emptyList: { flexGrow: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: SPACING.m,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.m,
    backgroundColor: COLORS.surface,
    marginBottom: SPACING.s,
  },
  unreadRow: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.m,
  },
  body: { flex: 1 },
  title: { fontSize: 13.5, fontWeight: '700', color: COLORS.textPrimary },
  message: { fontSize: 12.5, color: COLORS.textSecondary, lineHeight: 17, marginTop: 2 },
  time: { fontSize: 10.5, color: COLORS.textTertiary, marginTop: SPACING.s },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    marginLeft: SPACING.s,
  },
});
export default NotificationsScreen;
