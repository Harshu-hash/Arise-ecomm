import { api } from '@core/api/axiosInstance';

export const settingsApi = {
  profile: () => api.get('/settings/profile').then((r) => r.data),
  updateProfile: (payload) => api.patch('/settings/profile', payload).then((r) => r.data),
  setVacation: (on) => api.post('/settings/vacation', { on }).then((r) => r.data),
  bank: () => api.get('/settings/bank').then((r) => r.data),
  setBankAccount: (payload) => api.put('/settings/bank/account', payload).then((r) => r.data),
  addPickupAddress: (payload) => api.post('/settings/bank/pickup-addresses', payload).then((r) => r.data),
  team: () => api.get('/settings/users').then((r) => r.data),
  inviteUser: (payload) => api.post('/settings/users/invite', payload).then((r) => r.data),
  revokeUser: (id) => api.post(`/settings/users/${id}/revoke`, {}).then((r) => r.data),
  updateNotifications: (payload) => api.patch('/settings/notifications', payload).then((r) => r.data),
};

export const settingsKeys = {
  profile: ['seller', 'settings', 'profile'],
  bank: ['seller', 'settings', 'bank'],
  team: ['seller', 'settings', 'team'],
};
