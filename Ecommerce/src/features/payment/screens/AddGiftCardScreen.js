import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../../constants/colors';
import { SPACING, RADIUS } from '../../../constants/spacing';
import { StatusBarManager } from '../../../shared/components';
import { useToast } from '../../../contexts/ToastContext';
import { useRedeemGiftCardMutation } from '@features/wallet';
const AddGiftCardScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets(),
    toast = useToast(),
    [code, setCode] = useState(''),
    [pin, setPin] = useState(''),
    [redeem, { isLoading }] = useRedeemGiftCardMutation();
  const submit = async () => {
    try {
      const result = await redeem({ code, pin }).unwrap();
      toast.show(`₹${result.transaction.amount} added to your wallet`, {
        variant: 'success',
        icon: 'check',
      });
      navigation.navigate('Wallet');
    } catch (error) {
      toast.show(error.message || 'Could not redeem this gift card', { variant: 'error' });
    }
  };
  return (
    <View style={styles.container}>
      <StatusBarManager barStyle="dark-content" themeColor={COLORS.surface} />
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity onPress={navigation.goBack}>
          <Icon name="arrow-left" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Redeem Gift Card</Text>
      </View>
      <View style={styles.content}>
        <Icon name="gift" size={36} color={COLORS.ratingGreen} />
        <Text style={styles.title}>Add verified gift-card credit</Text>
        <Text style={styles.subtitle}>
          The code and PIN are validated securely. Balance changes only after the server creates a
          completed ledger transaction.
        </Text>
        <TextInput
          value={code}
          onChangeText={value => setCode(value.toUpperCase())}
          autoCapitalize="characters"
          placeholder="Gift card code"
          placeholderTextColor={COLORS.textTertiary}
          style={styles.input}
        />
        <TextInput
          value={pin}
          onChangeText={setPin}
          secureTextEntry
          keyboardType="number-pad"
          placeholder="PIN"
          placeholderTextColor={COLORS.textTertiary}
          style={styles.input}
        />
        <TouchableOpacity
          disabled={!code.trim() || !pin.trim() || isLoading}
          onPress={submit}
          style={[styles.button, (!code.trim() || !pin.trim() || isLoading) && styles.disabled]}
        >
          <Text style={styles.buttonText}>{isLoading ? 'Validating...' : 'Redeem Card'}</Text>
        </TouchableOpacity>
      </View>
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
  headerTitle: { fontSize: 19, fontWeight: '600', color: COLORS.textPrimary },
  content: { padding: SPACING.xl, alignItems: 'center' },
  title: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary, marginTop: SPACING.l },
  subtitle: {
    fontSize: 12.5,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginVertical: SPACING.l,
  },
  input: {
    alignSelf: 'stretch',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.s,
    padding: SPACING.m,
    color: COLORS.textPrimary,
    marginBottom: SPACING.m,
  },
  button: {
    alignSelf: 'stretch',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.s,
    padding: SPACING.m,
    alignItems: 'center',
  },
  disabled: { backgroundColor: COLORS.border },
  buttonText: { color: COLORS.white, fontWeight: '700' },
});
export default AddGiftCardScreen;
