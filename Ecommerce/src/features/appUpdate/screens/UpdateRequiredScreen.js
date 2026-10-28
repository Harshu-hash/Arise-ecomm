import React from 'react';
import { View, Text, StyleSheet, Linking } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../../constants/colors';
import { SPACING } from '../../../constants/spacing';
import { StatusBarManager } from '../../../shared/components';
import AppButton from '../../../shared/buttons/AppButton';

// Placeholder store link — wire up to the real listing once the app is published.
const STORE_URL = 'https://play.google.com/store/apps';

const UpdateRequiredScreen = () => {
  const handleUpdate = () => {
    Linking.openURL(STORE_URL).catch(() => {});
  };

  return (
    <View style={styles.container}>
      <StatusBarManager barStyle="dark-content" themeColor={COLORS.background} />
      <View style={styles.iconCircle}>
        <Icon name="download" size={40} color={COLORS.primary} />
      </View>
      <Text style={styles.title}>Update Required</Text>
      <Text style={styles.message}>
        A new version of Arise is available with important fixes and improvements.
        Please update to continue shopping.
      </Text>
      <AppButton title="Update Now" onPress={handleUpdate} size="lg" style={styles.cta} />
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
    backgroundColor: COLORS.primaryLight,
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

export default UpdateRequiredScreen;
