import React, { useState } from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../../constants/colors';
import { RADIUS, SPACING } from '../../../constants/spacing';
import { StatusBarManager } from '../../../shared/components';
import { useCreatePaymentMethodSetupMutation } from '../api/payment.api';

const AddCardScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState('');
  const [createSetup, { isLoading }] = useCreatePaymentMethodSetupMutation();

  const begin = async () => {
    setMessage('');
    try {
      const returnUrl = 'arise://payment-methods/setup-complete';
      const setup = await createSetup({
        returnUrl,
        idempotencyKey: `payment-method-setup:${returnUrl}`,
      }).unwrap();
      if (!setup.providerAction.url) throw new Error('Payment provider did not return a secure URL.');
      await Linking.openURL(setup.providerAction.url);
      setMessage('Complete setup with the payment provider, then return to Arise.');
    } catch (requestError) {
      setMessage(requestError.message || 'Could not start secure card setup.');
    }
  };

  return (
    <View style={styles.container}>
      <StatusBarManager barStyle="dark-content" themeColor={COLORS.surface} />
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity onPress={() => navigation?.goBack()}>
          <Icon name="arrow-left" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Card Securely</Text>
      </View>
      <View style={styles.body}>
        <View style={styles.iconCircle}>
          <Icon name="shield" size={34} color={COLORS.primary} />
        </View>
        <Text style={styles.title}>Provider-hosted card setup</Text>
        <Text style={styles.description}>
          Card number and CVV are entered directly with our PCI-compliant payment provider. Arise
          never receives or stores those details.
        </Text>
        {message ? <Text style={styles.message}>{message}</Text> : null}
        <TouchableOpacity disabled={isLoading} style={styles.button} onPress={begin}>
          <Text style={styles.buttonText}>{isLoading ? 'Opening securely...' : 'Continue securely'}</Text>
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
  headerTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '600' },
  body: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.xxl },
  iconCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { marginTop: SPACING.l, fontSize: 18, fontWeight: '800', color: COLORS.textPrimary },
  description: {
    marginTop: SPACING.m,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  message: { marginTop: SPACING.l, color: COLORS.textSecondary, textAlign: 'center' },
  button: {
    marginTop: SPACING.xl,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.s,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.m,
  },
  buttonText: { color: COLORS.white, fontWeight: '800' },
});

export default AddCardScreen;
