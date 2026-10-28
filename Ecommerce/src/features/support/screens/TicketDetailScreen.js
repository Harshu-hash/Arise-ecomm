import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../../constants/colors';
import { SPACING, RADIUS } from '../../../constants/spacing';
import { StatusBarManager } from '../../../shared/components';
import { MOCK_TICKETS } from '../constants/helpData';

const STATUS_STYLES = {
  Open: { bg: COLORS.offerRedLight, text: COLORS.offerRed },
  'In Progress': { bg: COLORS.primaryLight, text: COLORS.primary },
  Resolved: { bg: COLORS.ratingGreenBg, text: COLORS.ratingGreen },
};

const TicketDetailScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const ticketId = route?.params?.ticketId;
  const ticket = MOCK_TICKETS.find((t) => t.id === ticketId) || MOCK_TICKETS[0];
  const [updates, setUpdates] = useState(ticket.updates);
  const [comment, setComment] = useState('');
  const statusStyle = STATUS_STYLES[ticket.status] || STATUS_STYLES.Open;

  const sendComment = () => {
    if (!comment.trim()) return;
    setUpdates((prev) => [
      ...prev,
      { id: `local-${Date.now()}`, author: 'You', text: comment.trim(), date: 'Just now' },
    ]);
    setComment('');
  };

  return (
    <View style={styles.container}>
      <StatusBarManager barStyle="dark-content" themeColor={COLORS.surface} />

      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity onPress={() => navigation && navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>#{ticket.id}</Text>
          <Text style={styles.headerSubtitle}>{ticket.subject}</Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: statusStyle.bg }]}>
          <Text style={[styles.statusText, { color: statusStyle.text }]}>{ticket.status}</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.metaRow}>
          <Icon name="package" size={14} color={COLORS.textTertiary} />
          <Text style={styles.metaText}>Order {ticket.orderId}</Text>
          <Text style={styles.metaDot}>·</Text>
          <Text style={styles.metaText}>Raised on {ticket.createdOn}</Text>
        </View>

        {updates.map((update) => {
          const isUser = update.author === 'You';
          return (
            <View key={update.id} style={[styles.messageRow, isUser && styles.messageRowUser]}>
              <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.agentBubble]}>
                <Text style={[styles.messageAuthor, isUser && styles.messageAuthorUser]}>{update.author}</Text>
                <Text style={[styles.messageText, isUser && styles.messageTextUser]}>{update.text}</Text>
                <Text style={[styles.messageDate, isUser && styles.messageDateUser]}>{update.date}</Text>
              </View>
            </View>
          );
        })}

        {ticket.status === 'Resolved' ? (
          <View style={styles.resolvedNote}>
            <Icon name="check-circle" size={16} color={COLORS.ratingGreen} />
            <Text style={styles.resolvedNoteText}>This ticket has been resolved.</Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, SPACING.m) }]}>
        <TextInput
          style={styles.input}
          value={comment}
          onChangeText={setComment}
          placeholder="Add a comment..."
          placeholderTextColor={COLORS.textTertiary}
        />
        <TouchableOpacity
          activeOpacity={0.85}
          disabled={!comment.trim()}
          onPress={sendComment}
          style={[styles.sendBtn, !comment.trim() && styles.sendBtnDisabled]}>
          <Icon name="send" size={17} color={COLORS.white} />
        </TouchableOpacity>
      </View>
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
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.l,
    paddingBottom: SPACING.m,
  },
  backBtn: {
    marginRight: SPACING.m,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  headerSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  statusPill: {
    borderRadius: RADIUS.xs,
    paddingHorizontal: SPACING.s,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: SPACING.l,
    paddingTop: SPACING.l,
    paddingBottom: SPACING.xl,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.l,
  },
  metaText: {
    fontSize: 11.5,
    color: COLORS.textTertiary,
  },
  metaDot: {
    fontSize: 11.5,
    color: COLORS.textTertiary,
  },
  messageRow: {
    marginBottom: SPACING.m,
    alignItems: 'flex-start',
  },
  messageRowUser: {
    alignItems: 'flex-end',
  },
  messageBubble: {
    maxWidth: '85%',
    borderRadius: RADIUS.m,
    padding: SPACING.m,
  },
  agentBubble: {
    backgroundColor: COLORS.mutedBg,
    borderTopLeftRadius: 2,
  },
  userBubble: {
    backgroundColor: COLORS.primary,
    borderTopRightRadius: 2,
  },
  messageAuthor: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  messageAuthorUser: {
    color: 'rgba(255,255,255,0.8)',
  },
  messageText: {
    fontSize: 13.5,
    color: COLORS.textPrimary,
    lineHeight: 19,
  },
  messageTextUser: {
    color: COLORS.white,
  },
  messageDate: {
    fontSize: 10,
    color: COLORS.textTertiary,
    marginTop: 4,
  },
  messageDateUser: {
    color: 'rgba(255,255,255,0.7)',
  },
  resolvedNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.m,
  },
  resolvedNoteText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: COLORS.ratingGreen,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.l,
    paddingTop: SPACING.m,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.surface,
    gap: SPACING.s,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.round,
    paddingHorizontal: SPACING.l,
    paddingVertical: SPACING.s,
    fontSize: 13.5,
    color: COLORS.textPrimary,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: COLORS.border,
  },
});

export default TicketDetailScreen;
