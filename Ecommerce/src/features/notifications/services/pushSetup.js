import { PermissionsAndroid, Platform } from 'react-native';
import { pushTokenStorage } from '../storage/pushTokenStorage';
import { registerPushToken } from './pushRegistration';

// Firebase push setup. @react-native-firebase is required lazily so the app (and its tests) load without the native module.
const newDeviceId = () => `${Platform.OS}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

async function permissionGranted(messaging) {
  if (Platform.OS === 'android') {
    if (Platform.Version < 33) return true; // notifications need a runtime permission from Android 13
    return (await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS)) === PermissionsAndroid.RESULTS.GRANTED;
  }
  const status = await messaging().requestPermission();
  return status === 1 || status === 2; // AUTHORIZED or PROVISIONAL
}

/** Asks for permission, registers this phone's Firebase token with the backend, and keeps it current. Returns a stop function. */
export async function startPushRegistration() {
  const messaging = require('@react-native-firebase/messaging').default;
  if (!(await permissionGranted(messaging))) return () => {};
  const deviceId = pushTokenStorage.get()?.deviceId ?? newDeviceId();
  const register = token => registerPushToken({ deviceId, token, platform: Platform.OS });
  await register(await messaging().getToken());
  return messaging().onTokenRefresh(token => register(token).catch(() => {}));
}
