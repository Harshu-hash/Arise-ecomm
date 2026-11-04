import { combineReducers } from '@reduxjs/toolkit';
import { baseApi } from '@core/api';
import authReducer from '@features/auth/redux/auth.slice';
import onboardingReducer from '@features/onboarding/redux/onboarding.slice';

export const rootReducer = combineReducers({
  auth: authReducer,
  onboarding: onboardingReducer,
  [baseApi.reducerPath]: baseApi.reducer,
});
