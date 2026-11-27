import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { selectIsAuthenticated } from '@features/auth';
import { unregisterStoredPushToken } from './services/pushRegistration';
import { startPushRegistration } from './services/pushSetup';

// Renders nothing: while a customer is signed in, this phone is registered for pushes; signing out removes it.
const PushRegistration = () => {
  const authenticated = useSelector(selectIsAuthenticated);
  const dispatch = useDispatch();
  useEffect(() => {
    if (!authenticated) return undefined;
    let stop = () => {};
    let cancelled = false;
    startPushRegistration(dispatch)
      .then(unsubscribe => (cancelled ? unsubscribe() : (stop = unsubscribe)))
      .catch(error => {
        if (__DEV__) console.warn('Push registration failed:', error?.message ?? error); // push is optional: never blocks the app
      });
    return () => {
      cancelled = true;
      stop();
      unregisterStoredPushToken().catch(() => {});
    };
  }, [authenticated, dispatch]);
  return null;
};

export default PushRegistration;
