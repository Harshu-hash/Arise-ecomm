import { navigationRef } from './navigationRef';

export const navigate = (name, params) => {
  if (navigationRef.isReady()) navigationRef.navigate(name, params);
};

export const goBack = () => {
  if (navigationRef.isReady() && navigationRef.canGoBack()) navigationRef.goBack();
};

export const resetRoot = state => {
  if (navigationRef.isReady()) navigationRef.resetRoot(state);
};
