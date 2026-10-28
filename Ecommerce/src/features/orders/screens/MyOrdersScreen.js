import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../../constants/colors';
import { SPACING, RADIUS } from '../../../constants/spacing';
import { StatusBarManager } from '../../../shared/components';
import { MOCK_ORDERS, STATUS_FILTERS, ORDER_STATUS, getOrderStatusGroup } from '../constants/ordersData';

const statusStyle = (status) => {
  if (status === ORDER_STATUS.DELIVERED) return { bg: COLORS.ratingGreenBg, color: COLORS.ratingGreen };
  if (status === ORDER_STATUS.CANCELLED || status === ORDER_STATUS.RETURNED) {
    return { bg: COLORS.offerRedLight, color: COLORS.offerRed };
  }
  return { bg: COLORS.primaryLight, color: COLORS.primary };
};

const MyOrdersScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [activeFilter, setActiveFilter] = useState('All');

  const orders = useMemo(() => {
    if (activeFilter === 'All') return MOCK_ORDERS;
    return MOCK_ORDERS.filter((order) => getOrderStatusGroup(order.status) === activeFilter);
  }, [activeFilter]);

  return (
    <View style={styles.container}>
      <StatusBarManager barStyle="dark-content" themeColor={COLORS.surface} />

      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity onPress={() => navigation && navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Orders</Text>
      </View>

      <View style={styles.filterRow}>
        {STATUS_FILTERS.map((filter) => (
          <TouchableOpacity
            key={filter}
            activeOpacity={0.8}
            onPress={() => setActiveFilter(filter)}
            style={[styles.filterChip, activeFilter === filter && styles.filterChipActive]}>
            <Text style={[styles.filterChipText, activeFilter === filter && styles.filterChipTextActive]}>
              {filter}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {orders.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Icon name="package" size={48} color={COLORS.border} />
          <Text style={styles.emptyTitle}>No orders here</Text>
          <Text style={styles.emptySubtitle}>Orders matching this filter will show up here.</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {orders.map((order) => {
            const pill = statusStyle(order.status);
            return (
              <TouchableOpacity
                key={order.id}
                activeOpacity={0.85}
                style={styles.card}
                onPress={() => navigation && navigation.navigate('OrderDetail', { order })}>
                <View style={styles.cardTopRow}>
                  <Text style={styles.orderId}>{order.id}</Text>
                  <Text style={styles.orderDate}>{order.date}</Text>
                </View>

                {order.items.map((item) => (
                  <View key={item.id} style={styles.itemRow}>
                    <Image source={{ uri: item.image }} style={styles.itemImage} resizeMode="cover" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
                      <Text style={styles.itemMeta}>Qty: {item.qty} · ₹{item.price}</Text>
                    </View>
                  </View>
                ))}

                <View style={styles.cardBottomRow}>
                  <View style={[styles.statusPill, { backgroundColor: pill.bg }]}>
                    <Text style={[styles.statusText, { color: pill.color }]}>{order.status}</Text>
                  </View>
                  <View style={styles.viewDetailsRow}>
                    <Text style={styles.viewDetailsText}>View Details</Text>
                    <Icon name="chevron-right" size={15} color={COLORS.primary} />
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
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
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.l,
    paddingBottom: SPACING.m,
  },
  backBtn: {
    marginRight: SPACING.m,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '500',
    color: COLORS.textPrimary,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.l,
    paddingBottom: SPACING.m,
    gap: SPACING.s,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  filterChip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.round,
    paddingHorizontal: SPACING.l,
    paddingVertical: 6,
  },
  filterChipActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  filterChipText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  filterChipTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: SPACING.l,
    paddingTop: SPACING.l,
    paddingBottom: SPACING.xxxl,
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
    justifyContent: 'space-between',
    marginBottom: SPACING.m,
  },
  orderId: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  orderDate: {
    fontSize: 12,
    color: COLORS.textTertiary,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.m,
    marginBottom: SPACING.m,
  },
  itemImage: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.s,
    backgroundColor: COLORS.mutedBg,
  },
  itemName: {
    fontSize: 12.5,
    color: COLORS.textPrimary,
    lineHeight: 17,
  },
  itemMeta: {
    fontSize: 11.5,
    color: COLORS.textTertiary,
    marginTop: 2,
  },
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: SPACING.m,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  statusPill: {
    borderRadius: RADIUS.xs,
    paddingHorizontal: SPACING.s,
    paddingVertical: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  viewDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewDetailsText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: COLORS.primary,
    marginRight: 2,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xxl,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: SPACING.l,
  },
  emptySubtitle: {
    fontSize: 12.5,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
    textAlign: 'center',
  },
});

export default MyOrdersScreen;
