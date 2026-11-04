import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { useDispatch } from 'react-redux';
import { apiClient } from '@core/api/axiosInstance';
import { API_TAGS, baseApi } from '@core/api/baseApi';
import { COLORS } from '@constants/colors';
import { SPACING } from '@constants/spacing';
import { setNetworkOnline } from './networkState';

const POLL_INTERVAL_MS = 15000;
const NetworkContext = createContext({ online: true, checking: false });

export const NetworkStatusProvider = ({ children }) => {
  const dispatch = useDispatch();
  const [state, setState] = useState({ online: true, checking: true });
  const previousOnline = useRef(true);

  useEffect(() => {
    let active = true;
    const check = async () => {
      try {
        await apiClient.get('/health', { timeout: 5000, __skipAuthRefresh: true });
        if (!active) return;
        setNetworkOnline(true);
        setState({ online: true, checking: false });
        if (!previousOnline.current) dispatch(baseApi.util.invalidateTags(API_TAGS));
        previousOnline.current = true;
      } catch {
        if (!active) return;
        setNetworkOnline(false);
        setState({ online: false, checking: false });
        previousOnline.current = false;
      }
    };
    check();
    const timer = setInterval(check, POLL_INTERVAL_MS);
    const subscription = AppState.addEventListener('change', next => {
      if (next === 'active') check();
    });
    return () => {
      active = false;
      clearInterval(timer);
      subscription.remove();
    };
  }, [dispatch]);

  return <NetworkContext.Provider value={state}>{children}</NetworkContext.Provider>;
};

export const useNetworkStatus = () => useContext(NetworkContext);

export const OfflineBanner = () => {
  const { online, checking } = useNetworkStatus();
  if (online || checking) return null;
  return (
    <View accessibilityRole="alert" style={styles.banner}>
      <Text style={styles.text}>Offline. Cached information may be shown; changes are disabled.</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: { backgroundColor: COLORS.warning, paddingHorizontal: SPACING.m, paddingVertical: SPACING.s },
  text: { color: COLORS.textPrimary, fontSize: 12, fontWeight: '700', textAlign: 'center' },
});
