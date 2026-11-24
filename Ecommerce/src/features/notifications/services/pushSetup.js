import { PermissionsAndroid, Platform } from 'react-native';
import { pushTokenStorage } from '../storage/pushTokenStorage';
import { registerPushToken } from './pushRegistration';

// Firebase push setup. @react-native-firebase is required lazily so the app (and its tests) load without the native module.
const newDeviceId = () => `${Platform.OS}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

async function permissionGranted(firebase, messaging) {
  if (Platform.OS === 'android') {
    if (Platform.Version < 33) return true; // notifications need a runtime permission from Android 13
    return (await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS)) === PermissionsAndroid.RESULTS.GRANTED;
  }
  const status = await firebase.requestPermission(messaging);
  return status === 1 || status === 2; // AUTHORIZED or PROVISIONAL
}

/** Asks for permission, registers this phone's Firebase token with the backend, and keeps it current. Returns a stop function. */
export async function startPushRegistration() {
  // The modular API: the namespaced `messaging()` call is deprecated and logs a warning on every use.
  const firebase = require('@react-native-firebase/messaging');
  const messaging = firebase.getMessaging(require('@react-native-firebase/app').getApp());
  if (!(await permissionGranted(firebase, messaging))) return () => {};
  const deviceId = pushTokenStorage.get()?.deviceId ?? newDeviceId();
  const register = token => registerPushToken({ deviceId, token, platform: Platform.OS });
  await register(await firebase.getToken(messaging));
  return firebase.onTokenRefresh(messaging, token => register(token).catch(() => {}));
}
