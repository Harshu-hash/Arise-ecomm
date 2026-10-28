import React, { createContext, useContext, useMemo, useState } from 'react';

const AppBootContext = createContext({
  hasSeenOnboarding: false,
  isLoggedIn: false,
  setHasSeenOnboarding: () => {},
  setIsLoggedIn: () => {},
});

/**
 * In-memory only (no AsyncStorage/MMKV) — resets every cold start on purpose,
 * since there's no backend yet to persist a real session against. Lets Splash
 * decide Onboarding/Login/MainTabs, and lets screens like Profile react to
 * whether the mock "login" happened this session.
 */
export const AppBootProvider = ({ children }) => {
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const value = useMemo(
    () => ({ hasSeenOnboarding, isLoggedIn, setHasSeenOnboarding, setIsLoggedIn }),
    [hasSeenOnboarding, isLoggedIn],
  );

  return <AppBootContext.Provider value={value}>{children}</AppBootContext.Provider>;
};

export const useAppBoot = () => useContext(AppBootContext);
