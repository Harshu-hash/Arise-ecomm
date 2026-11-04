import React, { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../../constants/colors';
import { SPACING, RADIUS } from '../../../constants/spacing';
import { StatusBarManager, BottomSheetModal } from '../../../shared/components';
import FullScreenLoader from '../../../shared/loaders/FullScreenLoader';
import ErrorState from '../../../shared/ErrorState/ErrorState';
import WalletHeroCard from '../components/WalletHeroCard';
import WalletTransactionList from '../components/WalletTransactionList';
import TransactionDetailSheet from '../components/TransactionDetailSheet';
import { HERO_GRADIENT } from '../data/walletData';
import { useGetWalletQuery, useGetWalletTransactionsQuery } from '../api/wallet.api';
const WalletScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets(),
    wallet = useGetWalletQuery(),
    ledger = useGetWalletTransactionsQuery({ limit: 20 }),
    [active, setActive] = useState(null);
  if (wallet.isLoading || ledger.isLoading)
    return <FullScreenLoader message="Loading wallet ledger..." />;
  if (wallet.error || ledger.error)
    return (
      <ErrorState
        title="Could not load wallet"
        message={(wallet.error || ledger.error)?.message}
        onRetry={() => {
          wallet.refetch();
          ledger.refetch();
        }}
      />
    );
  const refresh = () => {
    wallet.refetch();
    ledger.refetch();
  };
  return (
    <View style={styles.container}>
      <StatusBarManager barStyle="light-content" themeColor={HERO_GRADIENT[0]} />
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={wallet.isFetching || ledger.isFetching} onRefresh={refresh} />
        }
        contentContainerStyle={styles.content}
      >
        <WalletHeroCard
          topInset={Math.max(insets.top, 12)}
          balance={wallet.data.balance}
          onBack={() => navigation.goBack()}
        />
        {wallet.data.expiryBuckets.length ? (
          <View style={styles.expiry}>
            <Text style={styles.expiryTitle}>Expiring credit</Text>
            {wallet.data.expiryBuckets.map(item => (
              <Text key={item.expiresAt} style={styles.expiryText}>
                ₹{item.amount} expires {new Date(item.expiresAt).toLocaleDateString('en-IN')}
              </Text>
            ))}
          </View>
        ) : null}
        <TouchableOpacity onPress={() => navigation.navigate('AddGiftCard')} style={styles.gift}>
          <Text style={styles.giftTitle}>Redeem a gift card</Text>
          <Text style={styles.giftText}>Credit is added only after server validation.</Text>
        </TouchableOpacity>
        <WalletTransactionList transactions={ledger.data.items} onPressTransaction={setActive} />
      </ScrollView>
      <BottomSheetModal visible={!!active} onClose={() => setActive(null)}>
        <TransactionDetailSheet transaction={active} />
      </BottomSheetModal>
    </View>
  );
};
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingBottom: SPACING.xxxl },
  expiry: {
    margin: SPACING.l,
    padding: SPACING.m,
    backgroundColor: COLORS.etaGoldLight,
    borderRadius: RADIUS.m,
  },
  expiryTitle: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary },
  expiryText: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4 },
  gift: {
    marginHorizontal: SPACING.l,
    padding: SPACING.l,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.m,
    backgroundColor: COLORS.surface,
  },
  giftTitle: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  giftText: { fontSize: 11.5, color: COLORS.textSecondary, marginTop: 3 },
});
export default WalletScreen;
