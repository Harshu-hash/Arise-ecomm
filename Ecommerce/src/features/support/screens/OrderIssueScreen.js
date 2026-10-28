import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../../constants/colors';
import { SPACING, RADIUS } from '../../../constants/spacing';
import { StatusBarManager } from '../../../shared/components';

const OrderIssueScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const order = route?.params?.order;

  const ISSUES = [
    order?.status !== 'Delivered' && {
      id: 'track',
      icon: 'map-pin',
      label: 'Track my order',
      onPress: () => navigation && navigation.navigate('Tracking'),
    },
    order?.canCancel && {
      id: 'cancel',
      icon: 'x-circle',
      label: 'Cancel this order',
      onPress: () => navigation && navigation.navigate('CancelOrder', { order }),
    },
    order?.canReturn && {
      id: 'return',
      icon: 'refresh-ccw',
      label: 'Return or replace item',
      onPress: () => navigation && navigation.navigate('ReturnReplace', { order }),
    },
    {
      id: 'missing',
      icon: 'alert-circle',
      label: 'I didn’t receive my order',
      onPress: () => navigation && navigation.navigate('RaiseTicket', { order, subjectId: 'delivery' }),
    },
    {
      id: 'damaged',
      icon: 'alert-triangle',
      label: 'Item is damaged or defective',
      onPress: () => navigation && navigation.navigate('RaiseTicket', { order, subjectId: 'product' }),
    },
    {
      id: 'refund',
      icon: 'rotate-ccw',
      label: 'Refund related query',
      onPress: () => navigation && navigation.navigate('RaiseTicket', { order, subjectId: 'refund' }),
    },
    {
      id: 'invoice',
      icon: 'file-text',
      label: 'Download invoice',
      onPress: () => navigation && navigation.navigate('RaiseTicket', { order, subjectId: 'other' }),
    },
    {
      id: 'other',
      icon: 'more-horizontal',
      label: 'Something else',
      onPress: () => navigation && navigation.navigate('RaiseTicket', { order, subjectId: 'other' }),
    },
  ].filter(Boolean);

  return (
    <View style={styles.container}>
      <StatusBarManager barStyle="dark-content" themeColor={COLORS.surface} />

      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity onPress={() => navigation && navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Get Help</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {order ? (
          <View style={styles.orderCard}>
            <Image source={{ uri: order.image }} style={styles.image} resizeMode="cover" />
            <View style={{ flex: 1 }}>
              <Text style={styles.orderName} numberOfLines={2}>{order.name}</Text>
              <Text style={styles.orderMeta}>{order.id} · {order.date}</Text>
              <Text style={styles.orderStatus}>{order.status}</Text>
            </View>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>What do you need help with?</Text>

        {ISSUES.map((issue) => (
          <TouchableOpacity key={issue.id} activeOpacity={0.7} style={styles.row} onPress={issue.onPress}>
            <View style={styles.rowIconBox}>
              <Icon name={issue.icon} size={17} color={COLORS.primary} />
            </View>
            <Text style={styles.rowLabel}>{issue.label}</Text>
            <Icon name="chevron-right" size={16} color={COLORS.textTertiary} />
          </TouchableOpacity>
        ))}
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
    width: 50,
    height: 50,
    borderRadius: RADIUS.s,
    backgroundColor: COLORS.white,
  },
  orderName: {
    fontSize: 12.5,
    fontWeight: '600',
    color: COLORS.textPrimary,
    lineHeight: 16,
    marginBottom: 3,
  },
  orderMeta: {
    fontSize: 11,
    color: COLORS.textTertiary,
    marginBottom: 2,
  },
  orderStatus: {
    fontSize: 11.5,
    fontWeight: '700',
    color: COLORS.primary,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.s,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.m,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: SPACING.m,
  },
  rowIconBox: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.s,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    flex: 1,
    fontSize: 13.5,
    color: COLORS.textPrimary,
  },
});

export default OrderIssueScreen;
