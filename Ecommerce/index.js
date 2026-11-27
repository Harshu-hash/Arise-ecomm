/**
 * App entry point. Registers the root component.
 * @format
 */
import { AppRegistry } from 'react-native';
import App from './src/app/App';
import { name as appName } from './app.json';

// Firebase and Notifee start a headless JS task when something arrives while the app is not in front; with no handler registered
// here at startup that task fails ("Module has not been registered as callable"). The system already shows the notification
// itself, so the handlers have nothing to do.
try {
  const firebase = require('@react-native-firebase/messaging');
  firebase.setBackgroundMessageHandler(firebase.getMessaging(require('@react-native-firebase/app').getApp()), async () => {});
  require('@notifee/react-native').default.onBackgroundEvent(async () => {});
} catch (error) {
  // a build without these native modules: nothing to register
}

AppRegistry.registerComponent(appName, () => App);
