import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../../constants/colors';
import { SPACING, RADIUS } from '../../../constants/spacing';
import { StatusBarManager } from '../../../shared/components';
import { MOCK_ORDERS } from '../constants/helpData';

const OrderHelpScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const intent = route?.params?.intent;

  return (
    <View style={styles.container}>
      <StatusBarManager barStyle="dark-content" themeColor={COLORS.surface} />

      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity onPress={() => navigation && navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Select an Order</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.introText}>Choose the order you need help with.</Text>

        {MOCK_ORDERS.map((order) => (
          <TouchableOpacity
            key={order.id}
            activeOpacity={0.8}
            style={styles.card}
            onPress={() => {
              if (!navigation) return;
              if (intent === 'cancel' && order.canCancel) {
                navigation.navigate('CancelOrder', { order });
              } else if (intent === 'return' && order.canReturn) {
                navigation.navigate('ReturnReplace', { order });
              } else if (intent === 'track') {
                navigation.navigate('OrderDetail', { order });
              } else {
                navigation.navigate('OrderIssue', { order });
              }
            }}>
            <Image source={{ uri: order.image }} style={styles.image} resizeMode="cover" />
            <View style={styles.cardInfo}>
              <Text style={styles.orderName} numberOfLines={2}>{order.name}</Text>
              <Text style={styles.orderMeta}>{order.id} · {order.date}</Text>
              <View style={styles.bottomRow}>
                <View style={[styles.statusPill, order.status === 'Delivered' && styles.statusPillDelivered]}>
                  <Text style={[styles.statusText, order.status === 'Delivered' && styles.statusTextDelivered]}>
                    {order.status}
                  </Text>
                </View>
                <Text style={styles.orderPrice}>₹{order.price}</Text>
              </View>
            </View>
            <Icon name="chevron-right" size={18} color={COLORS.textTertiary} />
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
  introText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: SPACING.l,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.m,
    padding: SPACING.m,
    marginBottom: SPACING.m,
    gap: SPACING.m,
  },
  image: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.s,
    backgroundColor: COLORS.mutedBg,
  },
  cardInfo: {
    flex: 1,
  },
  orderName: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
    lineHeight: 17,
    marginBottom: 4,
  },
  orderMeta: {
    fontSize: 11.5,
    color: COLORS.textTertiary,
    marginBottom: SPACING.xs,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusPill: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.xs,
    paddingHorizontal: SPACING.s,
    paddingVertical: 2,
  },
  statusPillDelivered: {
    backgroundColor: COLORS.ratingGreenBg,
  },
  statusText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: COLORS.primary,
  },
  statusTextDelivered: {
    color: COLORS.ratingGreen,
  },
  orderPrice: {
    fontSize: 12.5,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
});

export default OrderHelpScreen;
