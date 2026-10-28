import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../../constants/colors';
import { SPACING, RADIUS } from '../../../constants/spacing';
import { StatusBarManager } from '../../../shared/components';

const INITIAL_PERMISSIONS = [
  { id: 'camera', icon: 'camera', label: 'Camera', subtitle: 'Used for scanning QR codes & lens search', enabled: true },
  { id: 'location', icon: 'map-pin', label: 'Location', subtitle: 'Used to show delivery estimates for your area', enabled: true },
  { id: 'contacts', icon: 'users', label: 'Contacts', subtitle: 'Used for referral invites', enabled: false },
  { id: 'storage', icon: 'hard-drive', label: 'Storage', subtitle: 'Used to save downloaded invoices & images', enabled: true },
  { id: 'microphone', icon: 'mic', label: 'Microphone', subtitle: 'Used for voice search', enabled: false },
];

const ManagePermissionsScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [permissions, setPermissions] = useState(INITIAL_PERMISSIONS);

  const toggle = (id) => {
    setPermissions((prev) => prev.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p)));
  };

  return (
    <View style={styles.container}>
      <StatusBarManager barStyle="dark-content" themeColor={COLORS.surface} />

      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity onPress={() => navigation && navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>App Permissions</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.introText}>
          Control which device features this app can access. You can change these anytime.
        </Text>

        {permissions.map((permission) => (
          <View key={permission.id} style={styles.row}>
            <View style={styles.iconBox}>
              <Icon name={permission.icon} size={18} color={COLORS.primary} />
            </View>
            <View style={styles.textBox}>
              <Text style={styles.label}>{permission.label}</Text>
              <Text style={styles.subtitle}>{permission.subtitle}</Text>
            </View>
            <Switch
              value={permission.enabled}
              onValueChange={() => toggle(permission.id)}
              trackColor={{ false: COLORS.border, true: COLORS.primaryLight }}
              thumbColor={permission.enabled ? COLORS.primary : COLORS.textTertiary}
            />
          </View>
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
    fontSize: 12.5,
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginBottom: SPACING.l,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.m,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.s,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.m,
  },
  textBox: {
    flex: 1,
    marginRight: SPACING.s,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 11.5,
    color: COLORS.textSecondary,
    lineHeight: 15,
  },
});

export default ManagePermissionsScreen;
