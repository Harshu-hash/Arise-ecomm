import { AppState } from 'react-native';
import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { baseApi, configureApiInterceptors } from '@core/api';
import { sessionCleared, tokensRefreshed } from '@features/auth/redux/auth.slice';
import { appMiddleware } from './middleware';
import { rootReducer } from './rootReducer';
import { secureSessionStorage } from '@core/storage/secureSessionStorage';

export const store = configureStore({
  reducer: rootReducer,
  middleware: appMiddleware,
  devTools: __DEV__,
});

configureApiInterceptors({
  getAccessToken: () => store.getState().auth.accessToken,
  getRefreshToken: () => store.getState().auth.refreshToken,
  onTokensRefreshed: session => {
    store.dispatch(tokensRefreshed(session));
    if (session.refreshToken) {
      secureSessionStorage.saveRefreshToken(session.refreshToken).catch(() => {});
    }
  },
  onSessionExpired: () => {
    secureSessionStorage.clear().catch(() => {});
    store.dispatch(sessionCleared());
    store.dispatch(baseApi.util.resetApiState());
  },
});

// React Native has no window focus events: map app foreground/background onto RTK Query's focus handling,
// so returning to the app refetches what is on screen (catches time-based changes, e.g. a sale that just started).
setupListeners(store.dispatch, (dispatch, { onFocus, onFocusLost }) => {
  let previous = AppState.currentState;
  const subscription = AppState.addEventListener('change', next => {
    if (next === 'active' && previous !== 'active') dispatch(onFocus());
    if (next !== 'active' && previous === 'active') dispatch(onFocusLost());
    previous = next;
  });
  return () => subscription.remove();
});

export const dispatch = store.dispatch;
export const getState = store.getState;
