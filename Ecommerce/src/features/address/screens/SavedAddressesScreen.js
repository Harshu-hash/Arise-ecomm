import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../../constants/colors';
import { SPACING, RADIUS } from '../../../constants/spacing';
import { StatusBarManager } from '../../../shared/components';
import FullScreenLoader from '../../../shared/loaders/FullScreenLoader';
import ErrorState from '../../../shared/ErrorState/ErrorState';
import EmptyState from '../../../shared/EmptyState/EmptyState';
import { useToast } from '../../../contexts/ToastContext';
import {
  useDeleteAddressMutation,
  useGetAddressesQuery,
  useMakeDefaultAddressMutation,
} from '../api/address.query';

const SavedAddressesScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const selectMode = route?.params?.selectMode;
  const returnScreen = route?.params?.returnScreen || 'Checkout';
  const toast = useToast();
  const { data, error, isLoading, isFetching, refetch } = useGetAddressesQuery();
  const [deleteAddress] = useDeleteAddressMutation();
  const [makeDefaultAddress] = useMakeDefaultAddressMutation();
  const addresses = data?.items ?? [];

  const handleSelect = address => {
    if (!navigation) return;
    navigation.navigate({
      name: returnScreen,
      params: { selectedAddressId: address.id },
      merge: true,
    });
  };

  const runMutation = async (request, successMessage) => {
    try {
      await request.unwrap();
      if (successMessage) toast.show(successMessage);
    } catch (mutationError) {
      toast.show(mutationError.message || 'Could not update this address.');
    }
  };

  if (isLoading) return <FullScreenLoader message="Loading addresses..." />;
  if (error && !data) return <ErrorState message={error.message} onRetry={refetch} />;

  return (
    <View style={styles.container}>
      <StatusBarManager barStyle="dark-content" themeColor={COLORS.surface} />

      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity onPress={() => navigation && navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {selectMode ? 'Select Delivery Address' : 'Saved Addresses'}
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isFetching}
            onRefresh={refetch}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
      >
        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.addBtn}
          onPress={() => navigation && navigation.navigate('AddEditAddress')}
        >
          <Icon name="plus" size={17} color={COLORS.primary} />
          <Text style={styles.addBtnText}>Add New Address</Text>
        </TouchableOpacity>

        {!addresses.length ? (
          <EmptyState
            icon="map-pin"
            title="No saved addresses"
            message="Add an address to see delivery availability and continue to checkout."
          />
        ) : null}

        {addresses.map(address => (
          <TouchableOpacity
            key={address.id}
            activeOpacity={selectMode ? 0.8 : 1}
            style={styles.card}
            onPress={selectMode ? () => handleSelect(address) : undefined}
          >
            <View style={styles.cardTopRow}>
              <View style={styles.labelPill}>
                <Text style={styles.labelPillText}>{address.label}</Text>
              </View>
              {address.isDefault ? (
                <View style={styles.defaultPill}>
                  <Text style={styles.defaultPillText}>DEFAULT</Text>
                </View>
              ) : null}
            </View>

            <Text style={styles.name}>{address.name}</Text>
            <Text style={styles.addressText}>{address.line}</Text>
            <Text style={styles.addressText}>{address.cityLine}</Text>
            <Text style={styles.phone}>Phone: {address.phone}</Text>

            {selectMode ? (
              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.deliverHereBtn}
                onPress={() => handleSelect(address)}
              >
                <Text style={styles.deliverHereText}>Deliver Here</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.actionsRow}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={styles.actionBtn}
                  onPress={() => navigation && navigation.navigate('AddEditAddress', { address })}
                >
                  <Icon name="edit-2" size={14} color={COLORS.primary} />
                  <Text style={styles.actionText}>Edit</Text>
                </TouchableOpacity>
                {!address.isDefault ? (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    style={styles.actionBtn}
                    onPress={() =>
                      runMutation(makeDefaultAddress(address.id), 'Default address updated')
                    }
                  >
                    <Icon name="check-circle" size={14} color={COLORS.success} />
                    <Text style={[styles.actionText, { color: COLORS.success }]}>Make default</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={styles.actionBtn}
                  onPress={() => runMutation(deleteAddress(address.id), 'Address removed')}
                >
                  <Icon name="trash-2" size={14} color={COLORS.error} />
                  <Text style={[styles.actionText, { color: COLORS.error }]}>Remove</Text>
                </TouchableOpacity>
              </View>
            )}
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
    fontSize: 20,
    fontWeight: '500',
    color: COLORS.textPrimary,
  },
  scrollContent: {
    paddingHorizontal: SPACING.l,
    paddingTop: SPACING.l,
    paddingBottom: SPACING.xxxl,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: RADIUS.s,
    paddingVertical: SPACING.m,
    marginBottom: SPACING.l,
    gap: SPACING.xs,
  },
  addBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
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
    marginBottom: SPACING.s,
  },
  labelPill: {
    backgroundColor: COLORS.mutedBg,
    borderRadius: RADIUS.xs,
    paddingHorizontal: SPACING.s,
    paddingVertical: 3,
    marginRight: SPACING.s,
  },
  labelPillText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  defaultPill: {
    borderWidth: 1,
    borderColor: COLORS.success,
    borderRadius: RADIUS.xs,
    paddingHorizontal: SPACING.s,
    paddingVertical: 3,
  },
  defaultPillText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: COLORS.success,
  },
  name: {
    fontSize: 14.5,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  addressText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  phone: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  actionsRow: {
    flexDirection: 'row',
    marginTop: SPACING.m,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: SPACING.m,
    gap: SPACING.xl,
  },
  deliverHereBtn: {
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.s,
    paddingVertical: SPACING.s + 2,
    marginTop: SPACING.m,
  },
  deliverHereText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 13,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },
});

export default SavedAddressesScreen;
