import { navigate } from '../../../navigation/navigationHelpers';
import { notificationsApi } from '../api/notifications.api';

// What a push opens: the same targets the in-app notification list uses (backend sends data: { notificationId, targetType, entityId }).
const DESTINATION = {
  PRODUCT: id => ['ProductDetail', { productId: id }],
  ORDER: id => ['OrderDetail', { orderId: id }],
  SHIPMENT: id => ['Tracking', { shipmentId: id }],
  CHAT: () => ['Chat'],
  CART: () => ['Cart'],
};

export function openPush(message) {
  const { targetType, entityId } = message?.data ?? {};
  const target = DESTINATION[targetType]?.(entityId);
  // no usable target (broadcasts, security notices): the notification list is the safe place to land
  if (target && (entityId || targetType === 'CHAT' || targetType === 'CART')) navigate(...target);
  else navigate('Notifications');
}

/**
 * The system does not show a push while the app is open, so it is shown as a real notification here (notifee), and tapping it
 * opens the same screen a background push would. Returns a stop function.
 */
export function listenForPushes(firebase, messaging, dispatch) {
  const stops = [firebase.onNotificationOpenedApp(messaging, openPush)]; // tapped while the app was in the background
  // tapped while the app was closed: wait a moment for navigation to be ready
  firebase.getInitialNotification(messaging).then(message => {
    if (message) setTimeout(() => openPush(message), 1500);
  });
  try {
    // loaded on use, like firebase, so the app and its tests load without the native modules
    const { default: api, AndroidImportance, EventType } = require('@notifee/react-native');
    const channel = api.createChannel({ id: 'default', name: 'Notifications', importance: AndroidImportance.HIGH });
    stops.push(
      firebase.onMessage(messaging, async message => {
        dispatch(notificationsApi.util.invalidateTags([{ type: 'Notification', id: 'LIST' }]));
        const { title, body } = message.notification ?? {};
        if (!title) return;
        await api.displayNotification({
          title,
          body,
          data: message.data,
          android: { channelId: await channel, pressAction: { id: 'default' } },
        });
      }),
      api.onForegroundEvent(({ type, detail }) => {
        if (type === EventType.PRESS) openPush({ data: detail.notification?.data });
      }),
    );
  } catch (error) {
    // an app build from before notifee was added: pushes still register and show in the background, just not while the app is open
    if (__DEV__) console.warn('Foreground notifications are off (rebuild the app):', error?.message ?? error);
  }
  return () => stops.forEach(stop => stop());
}
