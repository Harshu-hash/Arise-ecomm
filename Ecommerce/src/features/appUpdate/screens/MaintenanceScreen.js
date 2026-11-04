import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../../constants/colors';
import { SPACING } from '../../../constants/spacing';
import { StatusBarManager } from '../../../shared/components';
import AppButton from '../../../shared/buttons/AppButton';

const MaintenanceScreen = ({ message, onRetry }) => {
  const [checking, setChecking] = useState(false);
  const retry = () => {
    setChecking(true);
    Promise.resolve(onRetry?.()).finally(() => setChecking(false));
  };
  return (
    <View style={styles.container}>
      <StatusBarManager barStyle="dark-content" themeColor={COLORS.background} />
      <Icon name="tool" size={44} color={COLORS.warning} />
      <Text style={styles.title}>Under Maintenance</Text>
      <Text style={styles.message}>
        {message || 'Arise is undergoing scheduled maintenance. Please try again shortly.'}
      </Text>
      <AppButton title="Retry" onPress={retry} loading={checking} size="lg" />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xxl,
  },
  title: { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary, marginTop: SPACING.l },
  message: {
    fontSize: 13.5,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginVertical: SPACING.l,
    lineHeight: 19,
  },
});
export default MaintenanceScreen;
