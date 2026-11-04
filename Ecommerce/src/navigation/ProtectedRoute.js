import React, { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { selectIsAuthenticated } from '@features/auth';
import FullScreenLoader from '@shared/loaders/FullScreenLoader';
import { AUTH_ROUTES, ROOT_ROUTES } from './routes';

export const withAuthGuard = Screen => {
  const ProtectedScreen = props => {
    const authenticated = useSelector(selectIsAuthenticated);
    const { navigation, route } = props;

    useEffect(() => {
      if (authenticated) return;
      navigation.getParent()?.navigate(ROOT_ROUTES.auth, {
        screen: AUTH_ROUTES.login,
        params: {
          returnTo: { name: route.name, params: route.params },
        },
      });
    }, [authenticated, navigation, route.name, route.params]);

    if (!authenticated) return <FullScreenLoader message="Login required" />;
    return <Screen {...props} />;
  };

  ProtectedScreen.displayName = `withAuthGuard(${Screen.displayName || Screen.name || 'Screen'})`;
  return ProtectedScreen;
};
