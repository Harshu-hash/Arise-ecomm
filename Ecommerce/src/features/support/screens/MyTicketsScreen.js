import React from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../../constants/colors';
import { SPACING, RADIUS } from '../../../constants/spacing';
import { StatusBarManager } from '../../../shared/components';
import FullScreenLoader from '../../../shared/loaders/FullScreenLoader';
import ErrorState from '../../../shared/ErrorState/ErrorState';
import EmptyState from '../../../shared/EmptyState/EmptyState';
import { useGetTicketsQuery } from '../api/support.api';
const MyTicketsScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets(),
    query = useGetTicketsQuery({ limit: 30 });
  if (query.isLoading) return <FullScreenLoader message="Loading support tickets..." />;
  if (query.error)
    return (
      <ErrorState
        title="Could not load tickets"
        message={query.error.message}
        onRetry={query.refetch}
      />
    );
  const items = query.data.items;
  return (
    <View style={styles.container}>
      <StatusBarManager barStyle="dark-content" themeColor={COLORS.surface} />
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity onPress={navigation.goBack}>
          <Icon name="arrow-left" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Support Tickets</Text>
      </View>
      <FlatList
        data={items}
        keyExtractor={item => item.id}
        contentContainerStyle={items.length ? styles.list : styles.emptyList}
        refreshControl={<RefreshControl refreshing={query.isFetching} onRefresh={query.refetch} />}
        ListEmptyComponent={
          <EmptyState
            icon="inbox"
            title="No support tickets"
            message="Tickets you raise will appear here."
          />
        }
        ListFooterComponent={
          <TouchableOpacity
            style={styles.newButton}
            onPress={() => navigation.navigate('RaiseTicket', {})}
          >
            <Icon name="plus" size={16} color={COLORS.primary} />
            <Text style={styles.newText}>Raise a New Ticket</Text>
          </TouchableOpacity>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('TicketDetail', { ticketId: item.id })}
          >
            <View style={styles.top}>
              <Text style={styles.id}>#{item.id}</Text>
              <Text style={styles.status}>{item.statusLabel}</Text>
            </View>
            <Text style={styles.subject}>{item.subjectLabel}</Text>
            <Text style={styles.description} numberOfLines={2}>
              {item.description}
            </Text>
            <View style={styles.meta}>
              <Text style={styles.metaText}>
                {item.orderId ? `Order ${item.orderId}` : 'Account issue'}
              </Text>
              <Text style={styles.metaText}>{item.createdOn}</Text>
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
  headerTitle: { fontSize: 19, fontWeight: '600', color: COLORS.textPrimary },
  list: { padding: SPACING.l },
  emptyList: { flexGrow: 1, padding: SPACING.l },
  card: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.m,
    padding: SPACING.l,
    marginBottom: SPACING.m,
    backgroundColor: COLORS.surface,
  },
  top: { flexDirection: 'row', justifyContent: 'space-between' },
  id: { fontSize: 12, fontWeight: '700', color: COLORS.textPrimary },
  status: { fontSize: 11, fontWeight: '700', color: COLORS.primary },
  subject: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary, marginTop: SPACING.s },
  description: { fontSize: 12.5, color: COLORS.textSecondary, lineHeight: 17, marginTop: 4 },
  meta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginTop: SPACING.m,
    paddingTop: SPACING.s,
  },
  metaText: { fontSize: 10.5, color: COLORS.textTertiary },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.s,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: RADIUS.s,
    padding: SPACING.m,
  },
  newText: { color: COLORS.primary, fontWeight: '700' },
});
export default MyTicketsScreen;
