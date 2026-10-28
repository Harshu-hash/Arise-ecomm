import React, { useRef, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../../constants/colors';
import { StatusBarManager, BottomSheetModal } from '../../../shared/components';
import { useToast } from '../../../contexts/ToastContext';
import { useWallet } from '../../../contexts/WalletContext';
import WalletHeroCard from '../components/WalletHeroCard';
import WalletQuickActions from '../components/WalletQuickActions';
import WalletRewardsSection from '../components/WalletRewardsSection';
import WalletTransactionList from '../components/WalletTransactionList';
import TransactionDetailSheet from '../components/TransactionDetailSheet';
import { HERO_GRADIENT, QUICK_ACTIONS, REWARD_CARDS } from '../data/walletData';

const WalletScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const wallet = useWallet();
  const scrollRef = useRef(null);
  const [activeTxn, setActiveTxn] = useState(null);

  const handleBack = () => {
    if (navigation && navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation && navigation.navigate('MainTabs', { screen: 'Home' });
    }
  };

  const handleQuickAction = (action) => {
    if (action.id === 'add') {
      navigation && navigation.navigate('AddMoney');
    } else if (action.id === 'history') {
      scrollRef.current?.scrollToEnd({ animated: true });
    } else {
      toast?.show('Coming soon', { icon: 'clock' });
    }
  };

  return (
    <View style={styles.container}>
      <StatusBarManager barStyle="light-content" themeColor={HERO_GRADIENT[0]} />

      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <WalletHeroCard
          topInset={Math.max(insets.top, 12)}
          balance={wallet?.balance ?? 0}
          coins={wallet?.coins ?? 0}
          onBack={handleBack}
          onAddMoney={() => navigation && navigation.navigate('AddMoney')}
          onRedeem={() => toast?.show('Coming soon', { icon: 'award' })}
        />

        <WalletQuickActions actions={QUICK_ACTIONS} onPressAction={handleQuickAction} />

        <WalletRewardsSection title="Rewards for you" cards={REWARD_CARDS} />

        <WalletTransactionList transactions={wallet?.transactions ?? []} onPressTransaction={setActiveTxn} />
      </ScrollView>

      <BottomSheetModal visible={Boolean(activeTxn)} onClose={() => setActiveTxn(null)}>
        <TransactionDetailSheet transaction={activeTxn} />
      </BottomSheetModal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingBottom: 32,
  },
});

export default WalletScreen;
