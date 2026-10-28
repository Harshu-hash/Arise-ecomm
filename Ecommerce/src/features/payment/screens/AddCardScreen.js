import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../../constants/colors';
import { SPACING, RADIUS } from '../../../constants/spacing';
import { StatusBarManager } from '../../../shared/components';

const AddCardScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [cardNumber, setCardNumber] = useState('');
  const [holder, setHolder] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');

  return (
    <View style={styles.container}>
      <StatusBarManager barStyle="dark-content" themeColor={COLORS.surface} />

      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity onPress={() => navigation && navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add New Card</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.previewCard}>
          <Icon name="credit-card" size={20} color={COLORS.white} />
          <Text style={styles.previewNumber}>
            {cardNumber ? cardNumber.padEnd(19, '•') : '•••• •••• •••• ••••'}
          </Text>
          <View style={styles.previewBottomRow}>
            <Text style={styles.previewHolder}>{holder || 'CARD HOLDER NAME'}</Text>
            <Text style={styles.previewExpiry}>{expiry || 'MM/YY'}</Text>
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Card Number</Text>
          <TextInput
            style={styles.input}
            value={cardNumber}
            onChangeText={setCardNumber}
            keyboardType="number-pad"
            maxLength={19}
            placeholder="1234 5678 9012 3456"
            placeholderTextColor={COLORS.textTertiary}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Card Holder Name</Text>
          <TextInput
            style={styles.input}
            value={holder}
            onChangeText={setHolder}
            autoCapitalize="characters"
            placeholder="Name as on card"
            placeholderTextColor={COLORS.textTertiary}
          />
        </View>

        <View style={styles.rowFields}>
          <View style={[styles.fieldGroup, styles.halfField]}>
            <Text style={styles.fieldLabel}>Expiry Date</Text>
            <TextInput
              style={styles.input}
              value={expiry}
              onChangeText={setExpiry}
              placeholder="MM/YY"
              placeholderTextColor={COLORS.textTertiary}
              maxLength={5}
            />
          </View>
          <View style={[styles.fieldGroup, styles.halfField]}>
            <Text style={styles.fieldLabel}>CVV</Text>
            <TextInput
              style={styles.input}
              value={cvv}
              onChangeText={setCvv}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={3}
              placeholder="•••"
              placeholderTextColor={COLORS.textTertiary}
            />
          </View>
        </View>

        <View style={styles.secureNote}>
          <Icon name="lock" size={14} color={COLORS.textTertiary} />
          <Text style={styles.secureNoteText}>
            Your card details are stored securely and encrypted end-to-end.
          </Text>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, SPACING.l) }]}>
        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.saveBtn}
          onPress={() => navigation && navigation.goBack()}>
          <Text style={styles.saveBtnText}>Save Card</Text>
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
  previewCard: {
    backgroundColor: COLORS.primaryDark,
    borderRadius: RADIUS.m,
    padding: SPACING.l,
    marginBottom: SPACING.xl,
  },
  previewNumber: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.white,
    letterSpacing: 1.5,
    marginTop: SPACING.xl,
    marginBottom: SPACING.l,
  },
  previewBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  previewHolder: {
    fontSize: 12.5,
    fontWeight: '600',
    color: COLORS.white,
  },
  previewExpiry: {
    fontSize: 12.5,
    fontWeight: '600',
    color: COLORS.white,
  },
  fieldGroup: {
    marginBottom: SPACING.l,
  },
  fieldLabel: {
    fontSize: 12.5,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.s,
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.m,
    fontSize: 14.5,
    color: COLORS.textPrimary,
  },
  rowFields: {
    flexDirection: 'row',
    gap: SPACING.m,
  },
  halfField: {
    flex: 1,
  },
  secureNote: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.s,
    gap: SPACING.xs,
  },
  secureNoteText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.textTertiary,
    lineHeight: 16,
  },
  footer: {
    paddingHorizontal: SPACING.l,
    paddingTop: SPACING.m,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  saveBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.s,
    paddingVertical: SPACING.m,
    alignItems: 'center',
  },
  saveBtnText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '700',
  },
});

export default AddCardScreen;
