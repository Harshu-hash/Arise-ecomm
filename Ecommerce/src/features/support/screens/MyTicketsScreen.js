import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
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

const MyTicketsScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <StatusBarManager barStyle="dark-content" themeColor={COLORS.surface} />

      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity onPress={() => navigation && navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Support Tickets</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {MOCK_TICKETS.length === 0 ? (
          <View style={styles.emptyBox}>
            <Icon name="inbox" size={32} color={COLORS.textTertiary} />
            <Text style={styles.emptyText}>You haven't raised any tickets yet.</Text>
          </View>
        ) : (
          MOCK_TICKETS.map((ticket) => {
            const statusStyle = STATUS_STYLES[ticket.status] || STATUS_STYLES.Open;
            return (
              <TouchableOpacity
                key={ticket.id}
                activeOpacity={0.8}
                style={styles.card}
                onPress={() => navigation && navigation.navigate('TicketDetail', { ticketId: ticket.id })}>
                <View style={styles.cardTopRow}>
                  <Text style={styles.ticketId}>#{ticket.id}</Text>
                  <View style={[styles.statusPill, { backgroundColor: statusStyle.bg }]}>
                    <Text style={[styles.statusText, { color: statusStyle.text }]}>{ticket.status}</Text>
                  </View>
                </View>
                <Text style={styles.subject}>{ticket.subject}</Text>
                <Text style={styles.description} numberOfLines={2}>{ticket.description}</Text>
                <View style={styles.cardBottomRow}>
                  <Text style={styles.metaText}>Order {ticket.orderId}</Text>
                  <Text style={styles.metaText}>{ticket.createdOn}</Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}

        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.newTicketBtn}
          onPress={() => navigation && navigation.navigate('RaiseTicket', {})}>
          <Icon name="plus" size={16} color={COLORS.primary} />
          <Text style={styles.newTicketBtnText}>Raise a New Ticket</Text>
        </TouchableOpacity>
      </ScrollView>
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
    fontSize: 19,
    fontWeight: '500',
    color: COLORS.textPrimary,
  },
  scrollContent: {
    paddingHorizontal: SPACING.l,
    paddingTop: SPACING.l,
    paddingBottom: SPACING.xxxl,
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: SPACING.xxxl,
  },
  emptyText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: SPACING.m,
  },
  card: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.m,
    padding: SPACING.l,
    marginBottom: SPACING.l,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.s,
  },
  ticketId: {
    fontSize: 12.5,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  statusPill: {
    borderRadius: RADIUS.xs,
    paddingHorizontal: SPACING.s,
    paddingVertical: 3,
  },
  statusText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  subject: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  description: {
    fontSize: 12.5,
    color: COLORS.textSecondary,
    lineHeight: 17,
    marginBottom: SPACING.m,
  },
  cardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: SPACING.s,
  },
  metaText: {
    fontSize: 11,
    color: COLORS.textTertiary,
  },
  newTicketBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: RADIUS.s,
    paddingVertical: SPACING.m,
    gap: SPACING.s,
    marginTop: SPACING.s,
  },
  newTicketBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: COLORS.primary,
  },
});

export default MyTicketsScreen;
