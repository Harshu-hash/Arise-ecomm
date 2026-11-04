import React from 'react';
import { Provider as ReduxProvider } from 'react-redux';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';
import { ThemeProvider } from '@theme';
import { COLORS } from '../constants/colors';
import { StatusBarManager } from '../shared/components';
import { BrandSwitchLoaderProvider } from '../contexts/BrandSwitchLoaderContext';
import { ToastProvider } from '../contexts/ToastContext';
import RootNavigator from '../navigation/RootNavigator';
import { linking } from '../navigation/linking';
import { navigationRef } from '../navigation/navigationRef';
import { store } from '@store';
import { SessionBootstrap } from './bootstrap';
import ErrorBoundary from './errorBoundary';
import { NetworkStatusProvider, OfflineBanner } from '@core/network';

const App = () => {
  return (
    <ReduxProvider store={store}>
      <ErrorBoundary>
        <NetworkStatusProvider>
          <GestureHandlerRootView style={styles.flex}>
            <SafeAreaProvider>
              <ThemeProvider>
                <StatusBarManager barStyle="dark-content" themeColor={COLORS.surface} />
                <OfflineBanner />
                <SessionBootstrap>
                  <ToastProvider>
                    <BrandSwitchLoaderProvider>
                      <NavigationContainer ref={navigationRef} linking={linking}>
                        <RootNavigator />
                      </NavigationContainer>
                    </BrandSwitchLoaderProvider>
                  </ToastProvider>
                </SessionBootstrap>
              </ThemeProvider>
            </SafeAreaProvider>
          </GestureHandlerRootView>
        </NetworkStatusProvider>
      </ErrorBoundary>
    </ReduxProvider>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
});

export default App;
