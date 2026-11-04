import React from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../../constants/colors';
import { SPACING } from '../../../constants/spacing';
import { StatusBarManager } from '../../../shared/components';
import AppButton from '../../../shared/buttons/AppButton';

const UpdateRequiredScreen = ({ storeUrl, message }) => (
  <View style={styles.container}>
    <StatusBarManager barStyle="dark-content" themeColor={COLORS.background} />
    <Icon name="download" size={44} color={COLORS.primary} />
    <Text style={styles.title}>Update Required</Text>
    <Text style={styles.message}>
      {message || 'A required Arise update is available. Please update to continue shopping.'}
    </Text>
    <AppButton title="Update Now" onPress={() => Linking.openURL(storeUrl).catch(() => {})} size="lg" />
  </View>
);

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
export default UpdateRequiredScreen;
