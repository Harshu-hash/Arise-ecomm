import React from 'react';
import { Share, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../../constants/colors';
import { SPACING, RADIUS } from '../../../constants/spacing';
import { StatusBarManager } from '../../../shared/components';
import FullScreenLoader from '../../../shared/loaders/FullScreenLoader';
import ErrorState from '../../../shared/ErrorState/ErrorState';
import { useGetReferralQuery } from '@features/wallet';
const ReferralScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets(),
    query = useGetReferralQuery();
  if (query.isLoading) return <FullScreenLoader message="Loading referral program..." />;
  if (query.error)
    return (
      <ErrorState
        title="Referral unavailable"
        message={query.error.message}
        onRetry={query.refetch}
      />
    );
  const referral = query.data;
  const share = () =>
    Share.share({ message: `${referral.shareMessage}\n${referral.shareUrl}` }).catch(() => {});
  return (
    <View style={styles.container}>
      <StatusBarManager barStyle="dark-content" themeColor={COLORS.surface} />
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity onPress={navigation.goBack}>
          <Icon name="arrow-left" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Refer &amp; Earn</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Icon name="gift" size={30} color={COLORS.white} />
          <Text style={styles.heroTitle}>Earn ₹{referral.rewardAmount} per eligible referral</Text>
          <Text style={styles.heroText}>{referral.shareMessage}</Text>
          <View style={styles.code}>
            <Text style={styles.codeText}>{referral.code}</Text>
          </View>
          <TouchableOpacity onPress={share} style={styles.share}>
            <Text style={styles.shareText}>Share Invite Link</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.stats}>
          <View>
            <Text style={styles.statValue}>{referral.successfulReferrals}</Text>
            <Text style={styles.statLabel}>Successful referrals</Text>
          </View>
          <View>
            <Text style={styles.statValue}>₹{referral.earnedAmount}</Text>
            <Text style={styles.statLabel}>Ledger earnings</Text>
          </View>
        </View>
        <Text style={styles.terms}>{referral.termsSummary}</Text>
      </ScrollView>
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
  content: { padding: SPACING.l },
  hero: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.l,
    padding: SPACING.xl,
    alignItems: 'center',
  },
  heroTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: COLORS.white,
    textAlign: 'center',
    marginTop: SPACING.m,
  },
  heroText: {
    fontSize: 12.5,
    color: COLORS.white,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: SPACING.s,
  },
  code: {
    alignSelf: 'stretch',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.white,
    borderRadius: RADIUS.s,
    padding: SPACING.m,
    marginTop: SPACING.l,
    alignItems: 'center',
  },
  codeText: { fontSize: 16, fontWeight: '800', color: COLORS.white, letterSpacing: 1 },
  share: {
    alignSelf: 'stretch',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.s,
    padding: SPACING.m,
    alignItems: 'center',
    marginTop: SPACING.l,
  },
  shareText: { color: COLORS.primary, fontWeight: '700' },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.m,
    padding: SPACING.l,
    marginTop: SPACING.l,
  },
  statValue: { fontSize: 20, fontWeight: '800', color: COLORS.ratingGreen, textAlign: 'center' },
  statLabel: { fontSize: 11.5, color: COLORS.textSecondary, marginTop: 3 },
  terms: { fontSize: 11.5, color: COLORS.textTertiary, lineHeight: 17, marginTop: SPACING.l },
});
export default ReferralScreen;
