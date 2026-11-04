import { baseApi } from '@core/api';

export const appMiddleware = getDefaultMiddleware =>
  getDefaultMiddleware({ serializableCheck: true }).concat(baseApi.middleware);
