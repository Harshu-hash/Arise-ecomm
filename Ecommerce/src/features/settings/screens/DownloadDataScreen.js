import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../../constants/colors';
import { SPACING, RADIUS } from '../../../constants/spacing';
import { StatusBarManager } from '../../../shared/components';

const DATA_CATEGORIES = [
  { id: 'profile', icon: 'user', label: 'Profile Information' },
  { id: 'orders', icon: 'package', label: 'Order History' },
  { id: 'addresses', icon: 'map-pin', label: 'Saved Addresses' },
  { id: 'reviews', icon: 'edit-2', label: 'Reviews & Ratings' },
  { id: 'activity', icon: 'activity', label: 'Browsing Activity' },
];

const DownloadDataScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [requested, setRequested] = useState(false);

  return (
    <View style={styles.container}>
      <StatusBarManager barStyle="dark-content" themeColor={COLORS.surface} />

      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity onPress={() => navigation && navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Download My Data</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.introText}>
          You can request a copy of the personal data we hold about you. This includes:
        </Text>

        {DATA_CATEGORIES.map((cat) => (
          <View key={cat.id} style={styles.row}>
            <Icon name={cat.icon} size={17} color={COLORS.primary} style={styles.rowIcon} />
            <Text style={styles.rowLabel}>{cat.label}</Text>
          </View>
        ))}

        <Text style={styles.noteText}>
          Your data export will be prepared as a downloadable file and a link will be sent to your
          registered email within 48 hours.
        </Text>

        {requested ? (
          <View style={styles.requestedBox}>
            <Icon name="check-circle" size={18} color={COLORS.success} />
            <Text style={styles.requestedText}>
              Request submitted. We'll email you when your data is ready.
            </Text>
          </View>
        ) : (
          <TouchableOpacity activeOpacity={0.85} style={styles.requestBtn} onPress={() => setRequested(true)}>
            <Icon name="download" size={16} color={COLORS.white} />
            <Text style={styles.requestBtnText}>Request Data Export</Text>
          </TouchableOpacity>
        )}
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
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 19,
    marginBottom: SPACING.l,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.s,
  },
  rowIcon: {
    marginRight: SPACING.m,
  },
  rowLabel: {
    fontSize: 13.5,
    color: COLORS.textPrimary,
  },
  noteText: {
    fontSize: 12,
    color: COLORS.textTertiary,
    lineHeight: 17,
    marginTop: SPACING.l,
    marginBottom: SPACING.xl,
  },
  requestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.s,
    paddingVertical: SPACING.m,
    gap: SPACING.s,
  },
  requestBtnText: {
    color: COLORS.white,
    fontSize: 14.5,
    fontWeight: '700',
  },
  requestedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.ratingGreenBg,
    borderRadius: RADIUS.s,
    padding: SPACING.m,
    gap: SPACING.s,
  },
  requestedText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textPrimary,
    lineHeight: 18,
  },
});

export default DownloadDataScreen;
