import {
  deviceRegistrationResponseSchema,
  notificationPreferencesResponseSchema,
  notificationResponseSchema,
  notificationsResponseSchema,
} from './notifications.schemas';
const icons = {
  ORDER: 'package',
  DELIVERY: 'truck',
  OFFER: 'tag',
  ACCOUNT: 'shield',
  SUPPORT: 'headphones',
};
const mapItem = item => ({
  ...item,
  message: item.body,
  read: !!item.readAt,
  icon: icons[item.category],
  timestamp: new Date(item.createdAt).toLocaleString('en-IN'),
});
export const mapNotifications = payload => {
  const data = notificationsResponseSchema.parse(payload).data;
  return { ...data, items: data.items.map(mapItem) };
};
export const mapNotification = payload => mapItem(notificationResponseSchema.parse(payload).data);
export const mapNotificationPreferences = payload =>
  notificationPreferencesResponseSchema.parse(payload).data;
export const mapDeviceRegistration = payload =>
  deviceRegistrationResponseSchema.parse(payload).data;
