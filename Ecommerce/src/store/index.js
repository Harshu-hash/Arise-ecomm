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

setupListeners(store.dispatch);

export const dispatch = store.dispatch;
export const getState = store.getState;
