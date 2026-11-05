import { api } from '@core/api/axiosInstance';

const stepped = (token) => ({ headers: { 'X-Step-Up-Token': token } });

export const securityApi = {
  overview: () => api.get('/settings/security').then((r) => r.data),
  reauth: (password) => api.post('/settings/security/reauth', { password }).then((r) => r.data),
  regenerateBackupCodes: (token) => api.post('/settings/security/backup-codes', {}, stepped(token)).then((r) => r.data),
  replaceAuthenticator: (token) => api.post('/settings/security/2fa/replace', {}, stepped(token)).then((r) => r.data),
  revokeSession: (id) => api.delete(`/settings/security/sessions/${id}`).then((r) => r.data),
  signOutAll: (token) => api.post('/settings/security/sign-out-all', {}, stepped(token)).then((r) => r.data),
  audit: () => api.get('/settings/audit').then((r) => r.data),
  roles: () => api.get('/settings/roles').then((r) => r.data),
  createRole: (payload, token) => api.post('/settings/roles', payload, stepped(token)).then((r) => r.data),
  updateRole: (id, payload) => api.patch(`/settings/roles/${id}`, payload).then((r) => r.data),
  deleteRole: (id) => api.delete(`/settings/roles/${id}`).then((r) => r.data),
  updateUser: (id, payload, token) => api.patch(`/settings/users/${id}`, payload, stepped(token)).then((r) => r.data),
  userAction: (id, action, token) => api.post(`/settings/users/${id}/${action}`, {}, token ? stepped(token) : undefined).then((r) => r.data),
  notificationPolicy: () => api.get('/settings/notification-policy').then((r) => r.data),
  updateNotificationPolicy: (payload) => api.patch('/settings/notification-policy', payload).then((r) => r.data),
  integrations: () => api.get('/settings/integrations').then((r) => r.data),
  apiKeys: () => api.get('/settings/api-keys').then((r) => r.data),
  createApiKey: (payload, token) => api.post('/settings/api-keys', payload, stepped(token)).then((r) => r.data),
  apiKeyAction: (id, action, token) => api.post(`/settings/api-keys/${id}/${action}`, {}, stepped(token)).then((r) => r.data),
  webhooks: () => api.get('/settings/webhooks').then((r) => r.data),
  createWebhook: (payload) => api.post('/settings/webhooks', payload).then((r) => r.data),
  rotateWebhookSecret: (id, token) => api.post(`/settings/webhooks/${id}/rotate-secret`, {}, stepped(token)).then((r) => r.data),
  retryDelivery: (id) => api.post(`/settings/webhook-deliveries/${id}/retry`, {}).then((r) => r.data),
};

export const securityKeys = {
  overview: ['seller', 'security', 'overview'], audit: ['seller', 'security', 'audit'], roles: ['seller', 'security', 'roles'], integrations: ['seller', 'security', 'integrations'], apiKeys: ['seller', 'security', 'api-keys'], webhooks: ['seller', 'security', 'webhooks'], notifications: ['seller', 'security', 'notifications'],
};
