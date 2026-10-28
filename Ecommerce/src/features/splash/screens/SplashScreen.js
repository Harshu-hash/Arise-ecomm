import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { COLORS } from '../../../constants/colors';
import { SPACING } from '../../../constants/spacing';
import { StatusBarManager } from '../../../shared/components';
import { useAppBoot } from '../../../contexts/AppBootContext';

const SPLASH_DURATION_MS = 1400;

const SplashScreen = ({ navigation }) => {
  const { hasSeenOnboarding, isLoggedIn } = useAppBoot();

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!navigation) return;
      if (isLoggedIn) {
        navigation.replace('MainTabs');
      } else if (!hasSeenOnboarding) {
        navigation.replace('Onboarding');
      } else {
        navigation.replace('Login');
      }
    }, SPLASH_DURATION_MS);

    return () => clearTimeout(timer);
  }, [navigation, hasSeenOnboarding, isLoggedIn]);

  return (
    <View style={styles.container}>
      <StatusBarManager barStyle="light-content" themeColor={COLORS.primary} />
      <View style={styles.logoCircle}>
        <Image
          source={require('../../../assets/images/price-tag.png')}
          style={styles.logoIcon}
          resizeMode="contain"
        />
      </View>
      <Text style={styles.brand}>Arise</Text>
      <Text style={styles.tagline}>Shop smarter, everyday</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.l,
  },
  logoIcon: {
    width: 44,
    height: 44,
  },
  brand: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: 0.5,
  },
  tagline: {
    fontSize: 13,
    color: COLORS.white,
    opacity: 0.85,
    marginTop: SPACING.xs,
  },
});

export default SplashScreen;
