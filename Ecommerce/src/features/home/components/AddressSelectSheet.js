import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../../constants/colors';
import { SPACING, RADIUS } from '../../../constants/spacing';
import { BottomSheetModal } from '../../../shared/components';

const AddressSelectSheet = ({ visible, onClose, addresses, selectedId, onSelectAddress, onAddNew }) => {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();

  return (
    <BottomSheetModal visible={visible} onClose={onClose}>
      <View style={styles.grabberRow}>
        <View style={styles.grabber} />
      </View>

      <View style={styles.header}>
        <Text style={styles.title}>Select delivery address</Text>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Icon name="x" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity activeOpacity={0.8} onPress={onAddNew} style={styles.addNewRow}>
        <View style={styles.addNewIcon}>
          <Icon name="plus" size={16} color={COLORS.primary} />
        </View>
        <Text style={styles.addNewText}>Add a new address</Text>
      </TouchableOpacity>

      <FlatList
        data={addresses}
        keyExtractor={(item) => item.id}
        style={{ maxHeight: windowHeight * 0.5 }}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, SPACING.l) }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const isSelected = item.id === selectedId;
          return (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => onSelectAddress(item)}
              style={[styles.addressRow, isSelected && styles.addressRowSelected]}>
              <View style={[styles.addressIcon, isSelected && styles.addressIconSelected]}>
                <Icon name={item.icon || 'map-pin'} size={16} color={isSelected ? COLORS.white : COLORS.textSecondary} />
              </View>

              <View style={styles.addressTextBlock}>
                <Text style={styles.addressLabel}>{item.label}</Text>
                <Text style={styles.addressLine} numberOfLines={2}>{item.address}</Text>
              </View>

              <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
                {isSelected && <View style={styles.radioInner} />}
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  grabberRow: {
    alignItems: 'center',
    paddingTop: SPACING.s,
  },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.l,
    paddingTop: SPACING.m,
    paddingBottom: SPACING.s,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  addNewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.s,
    paddingHorizontal: SPACING.l,
    paddingVertical: SPACING.m,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
  },
  addNewIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primaryLight,
  },
  addNewText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.m,
    paddingHorizontal: SPACING.l,
    paddingVertical: SPACING.m,
  },
  addressRowSelected: {
    backgroundColor: COLORS.primaryLight,
  },
  addressIcon: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.m,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.mutedBg,
  },
  addressIconSelected: {
    backgroundColor: COLORS.primary,
  },
  addressTextBlock: {
    flex: 1,
  },
  addressLabel: {
    fontSize: 13.5,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  addressLine: {
    fontSize: 12.5,
    color: COLORS.textSecondary,
    lineHeight: 17,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: COLORS.primary,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
  },
});

export default AddressSelectSheet;
