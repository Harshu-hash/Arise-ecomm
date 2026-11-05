import { api } from '@core/api/axiosInstance';

export const settingsApi = {
  profile: () => api.get('/settings/profile').then((r) => r.data),
  updateProfile: (payload) => api.patch('/settings/profile', payload).then((r) => r.data),
  requestVerifiedChange: (payload) => api.post('/settings/profile/change-requests', payload).then((r) => r.data),
  renewDocument: (documentId, payload) => api.post(`/settings/profile/documents/${documentId}/renew`, payload).then((r) => r.data),
  setVacation: (on) => api.post('/settings/vacation', { on }).then((r) => r.data),
  bank: () => api.get('/settings/bank').then((r) => r.data),
  setBankAccount: (payload, stepUpToken) => api.put('/settings/bank/account', payload, stepUpToken ? { headers: { 'X-Step-Up-Token': stepUpToken } } : undefined).then((r) => r.data),
  addPickupAddress: (payload) => api.post('/settings/bank/pickup-addresses', payload).then((r) => r.data),
  warehouses: () => api.get('/settings/warehouses').then((r) => r.data),
  createWarehouse: (payload) => api.post('/settings/warehouses', payload).then((r) => r.data),
  updateWarehouse: (id, payload) => api.patch(`/settings/warehouses/${id}`, payload).then((r) => r.data),
  deactivateWarehouse: (id) => api.post(`/settings/warehouses/${id}/deactivate`, {}).then((r) => r.data),
  team: () => api.get('/settings/users').then((r) => r.data),
  inviteUser: (payload) => api.post('/settings/users/invite', payload).then((r) => r.data),
  revokeUser: (id) => api.post(`/settings/users/${id}/revoke`, {}).then((r) => r.data),
  updateNotifications: (payload) => api.patch('/settings/notifications', payload).then((r) => r.data),
};

export const settingsKeys = {
  profile: ['seller', 'settings', 'profile'],
  bank: ['seller', 'settings', 'bank'],
  warehouses: ['seller', 'settings', 'warehouses'],
  team: ['seller', 'settings', 'team'],
};
