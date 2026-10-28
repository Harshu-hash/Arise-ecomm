import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import BrandSwitchLoader from '../shared/components/BrandSwitchLoader';

const BrandSwitchLoaderContext = createContext({ showBrandLoader: () => {}, hideBrandLoader: () => {} });

/**
 * Hosts the Arise <-> Deals switch loader at the app root so it survives the screen change
 * it covers (the Deals screen is popped when returning to Arise, so a loader owned by that
 * screen would vanish mid-transition).
 */
export const BrandSwitchLoaderProvider = ({ children }) => {
  const [state, setState] = useState({ visible: false, tab: null });
  const hideTimer = useRef(null);

  const clearTimer = () => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  };

  const showBrandLoader = useCallback((tab) => {
    clearTimer();
    setState({ visible: true, tab });
  }, []);

  const hideBrandLoader = useCallback((delayMs = 0) => {
    clearTimer();
    hideTimer.current = setTimeout(() => {
      hideTimer.current = null;
      setState((prev) => ({ ...prev, visible: false }));
    }, delayMs);
  }, []);

  useEffect(() => clearTimer, []);

  const value = useMemo(() => ({ showBrandLoader, hideBrandLoader }), [showBrandLoader, hideBrandLoader]);

  return (
    <BrandSwitchLoaderContext.Provider value={value}>
      {children}
      <BrandSwitchLoader visible={state.visible} tab={state.tab} />
    </BrandSwitchLoaderContext.Provider>
  );
};

export const useBrandSwitchLoader = () => useContext(BrandSwitchLoaderContext);
