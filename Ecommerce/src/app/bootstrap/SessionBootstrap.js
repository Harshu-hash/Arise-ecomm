import React, { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { selectSessionRestored } from '@features/auth';
import { selectOnboardingRestored } from '@features/onboarding/redux/onboarding.selectors';
import { useGetAppConfigQuery } from '@features/home';
import MaintenanceScreen from '@features/appUpdate/screens/MaintenanceScreen';
import UpdateRequiredScreen from '@features/appUpdate/screens/UpdateRequiredScreen';
import { APP_CONFIG } from '@configs/app.config';
import { validateRuntimeEnvironment } from '@configs';
import { preferencesStorage } from '@core/storage';
import ErrorState from '@shared/ErrorState/ErrorState';
import FullScreenLoader from '@shared/loaders/FullScreenLoader';
import { restoreCustomerSession } from './restoreSession';
import { restoreAppPreferences } from './restorePreferences';
import { versionIsBelow } from './version';

export { versionIsBelow } from './version';

const readCachedConfig = () => {
  try {
    const value = preferencesStorage.getString(APP_CONFIG.appConfigCacheKey);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
};

const SessionBootstrap = ({ children }) => {
  const dispatch = useDispatch();
  const restored = useSelector(selectSessionRestored);
  const preferencesRestored = useSelector(selectOnboardingRestored);
  const [cachedConfig, setCachedConfig] = useState(readCachedConfig);
  const bootReady = restored && preferencesRestored;
  const { data, isLoading, error, refetch } = useGetAppConfigQuery(undefined, { skip: !bootReady });
  const appConfig = data || cachedConfig;
  const environmentErrors = validateRuntimeEnvironment();

  useEffect(() => {
    restoreAppPreferences(dispatch);
    restoreCustomerSession(dispatch);
  }, [dispatch]);

  useEffect(() => {
    if (!data) return;
    preferencesStorage.setString(APP_CONFIG.appConfigCacheKey, JSON.stringify(data));
    setCachedConfig(data);
  }, [data]);

  if (environmentErrors.length)
    return (
      <ErrorState
        title="App configuration is incomplete"
        message={environmentErrors.join('\n')}
      />
    );
  if (!bootReady) return <FullScreenLoader message="Preparing Arise..." />;
  if (isLoading && !appConfig) return <FullScreenLoader message="Checking app availability..." />;
  if (error && !appConfig)
    return <ErrorState title="Could not start Arise" message={error.message} onRetry={refetch} />;
  if (appConfig?.maintenance.enabled)
    return <MaintenanceScreen message={appConfig.maintenance.message} onRetry={refetch} />;
  if (appConfig && versionIsBelow(APP_CONFIG.version, appConfig.minimumSupportedVersion)) {
    const storeUrl = Platform.OS === 'ios' ? appConfig.storeUrls.ios : appConfig.storeUrls.android;
    return <UpdateRequiredScreen storeUrl={storeUrl} />;
  }
  return children;
};

export default SessionBootstrap;
