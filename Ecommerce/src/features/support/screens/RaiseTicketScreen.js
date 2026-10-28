import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../../constants/colors';
import { SPACING, RADIUS } from '../../../constants/spacing';
import { StatusBarManager } from '../../../shared/components';
import { TICKET_SUBJECTS } from '../constants/helpData';

const RaiseTicketScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const order = route?.params?.order;
  const [subjectId, setSubjectId] = useState(route?.params?.subjectId || null);
  const [description, setDescription] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const ticketId = `HLP-${Math.floor(10000 + Math.random() * 89999)}`;

  if (submitted) {
    return (
      <View style={styles.container}>
        <StatusBarManager barStyle="dark-content" themeColor={COLORS.surface} />
        <View style={styles.successWrap}>
          <View style={styles.successIconCircle}>
            <Icon name="check" size={32} color={COLORS.white} />
          </View>
          <Text style={styles.successTitle}>Ticket Raised</Text>
          <Text style={styles.ticketIdText}>#{ticketId}</Text>
          <Text style={styles.successSubtitle}>
            Our support team will review your issue and respond within 24 hours. You can track the
            status anytime from My Support Tickets.
          </Text>
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.primaryBtn}
            onPress={() => navigation && navigation.navigate('MyTickets')}>
            <Text style={styles.primaryBtnText}>View My Tickets</Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.secondaryBtn}
            onPress={() => navigation && navigation.navigate('HelpCenter')}>
            <Text style={styles.secondaryBtnText}>Back to Help Center</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBarManager barStyle="dark-content" themeColor={COLORS.surface} />

      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity onPress={() => navigation && navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Raise a Ticket</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {order ? (
          <View style={styles.orderCard}>
            <Image source={{ uri: order.image }} style={styles.image} resizeMode="cover" />
            <View style={{ flex: 1 }}>
              <Text style={styles.orderName} numberOfLines={2}>{order.name}</Text>
              <Text style={styles.orderMeta}>{order.id}</Text>
            </View>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>What is this about?</Text>
        <View style={styles.subjectGrid}>
          {TICKET_SUBJECTS.map((subject) => (
            <TouchableOpacity
              key={subject.id}
              activeOpacity={0.8}
              onPress={() => setSubjectId(subject.id)}
              style={[styles.subjectChip, subjectId === subject.id && styles.subjectChipActive]}>
              <Icon
                name={subject.icon}
                size={14}
                color={subjectId === subject.id ? COLORS.primary : COLORS.textSecondary}
              />
              <Text style={[styles.subjectChipText, subjectId === subject.id && styles.subjectChipTextActive]}>
                {subject.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Describe your issue</Text>
        <TextInput
          style={styles.textArea}
          value={description}
          onChangeText={setDescription}
          multiline
          placeholder="Please share as much detail as possible so we can help you faster"
          placeholderTextColor={COLORS.textTertiary}
        />

        <TouchableOpacity activeOpacity={0.7} style={styles.attachRow}>
          <Icon name="paperclip" size={16} color={COLORS.primary} />
          <Text style={styles.attachText}>Add Photo (optional)</Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, SPACING.l) }]}>
        <TouchableOpacity
          activeOpacity={0.85}
          disabled={!subjectId || !description.trim()}
          style={[styles.submitBtn, (!subjectId || !description.trim()) && styles.submitBtnDisabled]}
          onPress={() => setSubmitted(true)}>
          <Text style={styles.submitBtnText}>Submit Ticket</Text>
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
    fontSize: 19,
    fontWeight: '500',
    color: COLORS.textPrimary,
  },
  scrollContent: {
    paddingHorizontal: SPACING.l,
    paddingTop: SPACING.l,
    paddingBottom: SPACING.xxxl,
  },
  orderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.mutedBg,
    borderRadius: RADIUS.m,
    padding: SPACING.m,
    gap: SPACING.m,
    marginBottom: SPACING.xl,
  },
  image: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.s,
    backgroundColor: COLORS.white,
  },
  orderName: {
    fontSize: 12.5,
    fontWeight: '600',
    color: COLORS.textPrimary,
    lineHeight: 16,
    marginBottom: 2,
  },
  orderMeta: {
    fontSize: 11,
    color: COLORS.textTertiary,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.m,
  },
  subjectGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.s,
    marginBottom: SPACING.xl,
  },
  subjectChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.round,
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
    gap: 6,
  },
  subjectChipActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  subjectChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  subjectChipTextActive: {
    color: COLORS.primary,
  },
  textArea: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.s,
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.m,
    fontSize: 13.5,
    color: COLORS.textPrimary,
    minHeight: 120,
    textAlignVertical: 'top',
    marginBottom: SPACING.m,
  },
  attachRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.s,
  },
  attachText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },
  footer: {
    paddingHorizontal: SPACING.l,
    paddingTop: SPACING.m,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  submitBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.s,
    paddingVertical: SPACING.m,
    alignItems: 'center',
  },
  submitBtnDisabled: {
    backgroundColor: COLORS.border,
  },
  submitBtnText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '700',
  },
  successWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
  },
  successIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.l,
  },
  successTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  ticketIdText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: SPACING.l,
  },
  successSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: SPACING.xxl,
  },
  primaryBtn: {
    alignSelf: 'stretch',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.s,
    paddingVertical: SPACING.m,
    alignItems: 'center',
    marginBottom: SPACING.m,
  },
  primaryBtnText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryBtn: {
    paddingVertical: SPACING.s,
  },
  secondaryBtnText: {
    color: COLORS.primary,
    fontSize: 13.5,
    fontWeight: '600',
  },
});

export default RaiseTicketScreen;
