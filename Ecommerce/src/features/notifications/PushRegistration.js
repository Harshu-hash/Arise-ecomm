import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { selectIsAuthenticated } from '@features/auth';
import { unregisterStoredPushToken } from './services/pushRegistration';
import { startPushRegistration } from './services/pushSetup';

// Renders nothing: while a customer is signed in, this phone is registered for pushes; signing out removes it.
const PushRegistration = () => {
  const authenticated = useSelector(selectIsAuthenticated);
  useEffect(() => {
    if (!authenticated) return undefined;
    let stop = () => {};
    let cancelled = false;
    startPushRegistration()
      .then(unsubscribe => (cancelled ? unsubscribe() : (stop = unsubscribe)))
      .catch(() => {}); // push is optional: a missing permission or Firebase setup never blocks the app
    return () => {
      cancelled = true;
      stop();
      unregisterStoredPushToken().catch(() => {});
    };
  }, [authenticated]);
  return null;
};

export default PushRegistration;
