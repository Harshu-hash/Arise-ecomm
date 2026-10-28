import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import Toast from '../shared/components/Toast';

const ToastContext = createContext({ show: () => {} });

const DEFAULT_DURATION = 2200;

/**
 * Mounted at the app root (alongside BrandSwitchLoaderProvider) so any screen can
 * call useToast().show(...) without each screen building its own inline banner.
 */
export const ToastProvider = ({ children }) => {
  const [state, setState] = useState({ visible: false, message: '', icon: null, variant: 'default' });
  const hideTimer = useRef(null);

  const show = useCallback((message, { icon, variant = 'default', duration = DEFAULT_DURATION } = {}) => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setState({ visible: true, message, icon, variant });
    hideTimer.current = setTimeout(() => {
      setState((prev) => ({ ...prev, visible: false }));
    }, duration);
  }, []);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toast visible={state.visible} message={state.message} icon={state.icon} variant={state.variant} />
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);
