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
import { useGetTicketQuery, useReplyToTicketMutation } from '../api/support.api';
import { useToast } from '../../../contexts/ToastContext';
const TicketDetailScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets(),
    toast = useToast(),
    ticketId = route?.params?.ticketId,
    query = useGetTicketQuery(ticketId, { skip: !ticketId }),
    [reply, { isLoading }] = useReplyToTicketMutation(),
    [body, setBody] = useState('');
  if (query.isLoading) return <FullScreenLoader message="Loading ticket..." />;
  if (query.error || !query.data)
    return (
      <ErrorState title="Ticket not found" message={query.error?.message} onRetry={query.refetch} />
    );
  const ticket = query.data;
  const send = async () => {
    try {
      await reply({ ticketId, body, attachmentMediaIds: [] }).unwrap();
      setBody('');
    } catch (error) {
      toast.show(error.message || 'Could not send reply', { variant: 'error' });
    }
  };
  return (
    <View style={styles.container}>
      <StatusBarManager barStyle="dark-content" themeColor={COLORS.surface} />
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity onPress={navigation.goBack}>
          <Icon name="arrow-left" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={styles.grow}>
          <Text style={styles.headerTitle}>#{ticket.id}</Text>
          <Text style={styles.subtitle}>
            {ticket.subjectLabel} · {ticket.statusLabel}
          </Text>
        </View>
      </View>
      <FlatList
        data={ticket.updates}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={query.isFetching} onRefresh={query.refetch} />}
        ListHeaderComponent={
          <View style={styles.sla}>
            <Text style={styles.slaTitle}>
              {ticket.orderId ? `Order ${ticket.orderId}` : 'Account support'}
            </Text>
            <Text style={styles.slaText}>
              {ticket.firstResponseDueAt
                ? `First response due ${new Date(ticket.firstResponseDueAt).toLocaleString('en-IN')}`
                : 'No active response SLA'}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const customer = item.authorType === 'CUSTOMER';
          return (
            <View style={[styles.messageRow, customer && styles.customerRow]}>
              <View style={[styles.bubble, customer ? styles.customerBubble : styles.agentBubble]}>
                <Text style={[styles.author, customer && styles.customerText]}>{item.author}</Text>
                <Text style={[styles.message, customer && styles.customerText]}>{item.text}</Text>
                <Text style={[styles.date, customer && styles.customerDate]}>{item.date}</Text>
              </View>
            </View>
          );
        }}
      />
      {ticket.canReply ? (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, SPACING.m) }]}>
          <TextInput
            value={body}
            onChangeText={setBody}
            maxLength={4000}
            placeholder="Add a reply..."
            placeholderTextColor={COLORS.textTertiary}
            style={styles.input}
          />
          <TouchableOpacity
            disabled={!body.trim() || isLoading}
            onPress={send}
            style={[styles.send, (!body.trim() || isLoading) && styles.disabled]}
          >
            <Icon name="send" size={17} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.closed}>
          <Text style={styles.closedText}>This ticket no longer accepts replies.</Text>
        </View>
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
  grow: { flex: 1 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary },
  subtitle: { fontSize: 11.5, color: COLORS.textSecondary },
  list: { padding: SPACING.l },
  sla: {
    padding: SPACING.m,
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.s,
    marginBottom: SPACING.l,
  },
  slaTitle: { fontSize: 12.5, fontWeight: '700', color: COLORS.textPrimary },
  slaText: { fontSize: 11, color: COLORS.textSecondary, marginTop: 3 },
  messageRow: { alignItems: 'flex-start', marginBottom: SPACING.m },
  customerRow: { alignItems: 'flex-end' },
  bubble: { maxWidth: '85%', padding: SPACING.m, borderRadius: RADIUS.m },
  agentBubble: { backgroundColor: COLORS.mutedBg },
  customerBubble: { backgroundColor: COLORS.primary },
  author: { fontSize: 10.5, fontWeight: '700', color: COLORS.textSecondary },
  message: { fontSize: 13.5, color: COLORS.textPrimary, lineHeight: 19, marginTop: 2 },
  date: { fontSize: 9.5, color: COLORS.textTertiary, marginTop: 4 },
  customerText: { color: COLORS.white },
  customerDate: { color: 'rgba(255,255,255,0.7)' },
  footer: {
    flexDirection: 'row',
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
  closed: { padding: SPACING.l, backgroundColor: COLORS.surface },
  closedText: { textAlign: 'center', fontSize: 12, color: COLORS.textSecondary },
});
export default TicketDetailScreen;
