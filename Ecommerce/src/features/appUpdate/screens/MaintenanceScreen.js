import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../../constants/colors';
import { SPACING } from '../../../constants/spacing';
import { StatusBarManager } from '../../../shared/components';
import AppButton from '../../../shared/buttons/AppButton';

const MaintenanceScreen = () => {
  const [checking, setChecking] = useState(false);

  const handleRetry = () => {
    setChecking(true);
    setTimeout(() => setChecking(false), 1000);
  };

  return (
    <View style={styles.container}>
      <StatusBarManager barStyle="dark-content" themeColor={COLORS.background} />
      <View style={styles.iconCircle}>
        <Icon name="tool" size={40} color={COLORS.warning} />
      </View>
      <Text style={styles.title}>Under Maintenance</Text>
      <Text style={styles.message}>
        Arise is currently undergoing scheduled maintenance. We'll be back shortly — thanks for your patience.
      </Text>
      <AppButton title="Retry" onPress={handleRetry} loading={checking} size="lg" style={styles.cta} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xxl,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: COLORS.etaGoldLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xl,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  message: {
    fontSize: 13.5,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.m,
    lineHeight: 19,
  },
  cta: {
    marginTop: SPACING.xxl,
    alignSelf: 'center',
  },
});

export default MaintenanceScreen;
