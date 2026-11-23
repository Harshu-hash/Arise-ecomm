import { Router } from 'express';
import { z } from 'zod';
import { ROLES } from '../../../shared/constants/roles.js';
import { sendCommand, sendData } from '../../../shared/http/respond.js';
import { validate } from '../../../shared/http/validate.js';
import { authenticate, authorize } from '../../../shared/middleware/authenticate.js';
import { sellerScope } from '../../../shared/policies/ownership.js';
import { objectIdSchema } from '../../../shared/validators/common.js';
import { getPreferences, listNotifications, listSellerAlerts, markAllRead, markRead, markSellerAlertRead, registerDevice, unregisterDevice, updatePreferences } from '../application/notification.service.js';

const listQuery = z.object({ limit: z.coerce.number().int().min(1).max(50).default(20), cursor: objectIdSchema.optional() });
const idParams = z.object({ notificationId: objectIdSchema });
const preferencesBody = z.object({
  orders: z.boolean(),
  delivery: z.boolean(),
  offers: z.boolean(),
  account: z.boolean(),
  support: z.boolean(),
  pushPermission: z.enum(['NOT_DETERMINED', 'GRANTED', 'DENIED']),
}).partial().strict().refine((body) => Object.keys(body).length > 0, { message: 'Say what to change.' });
const deviceBody = z.object({ deviceId: z.string().trim().min(1).max(128), token: z.string().trim().min(10).max(4096), platform: z.enum(['android', 'ios']) }).strict();
const deviceParams = z.object({ deviceId: z.string().trim().min(1).max(128) });
const alertParams = z.object({ key: z.string().trim().min(1).max(200) });

const route = (handler) => async (req, res, next) => {
  try {
    return await handler(req, res);
  } catch (error) {
    return next(error);
  }
};

// Mounted at /api/customer/v1: the signed-in customer's notifications, preferences and phones.
export function createCustomerNotificationRouter() {
  const router = Router();
  const customerOnly = [authenticate, authorize(ROLES.CUSTOMER)];
  const me = (req) => req.auth.userId;

  router.get('/notifications', ...customerOnly, validate({ query: listQuery }), route(async (req, res) => sendData(res, await listNotifications(me(req), req.query))));
  router.put('/notifications/read-all', ...customerOnly, route(async (req, res) => sendCommand(res, await markAllRead(me(req)))));
  router.route('/notifications/preferences')
    .get(...customerOnly, route(async (req, res) => sendData(res, await getPreferences(me(req)))))
    .patch(...customerOnly, validate({ body: preferencesBody }), route(async (req, res) => sendData(res, await updatePreferences(me(req), req.body))));
  router.put('/notifications/:notificationId/read', ...customerOnly, validate({ params: idParams }), route(async (req, res) => sendData(res, await markRead(me(req), req.params.notificationId))));
  router.post('/devices/push-tokens', ...customerOnly, validate({ body: deviceBody }), route(async (req, res) => sendData(res, await registerDevice(me(req), req.body))));
  router.delete('/devices/push-tokens/:deviceId', ...customerOnly, validate({ params: deviceParams }), route(async (req, res) => sendCommand(res, await unregisterDevice(me(req), req.params.deviceId))));

  return router;
}

// Mounted at /api/seller/v1/dashboard: the seller panel's header bell.
export function createSellerAlertRouter() {
  const router = Router();
  router.use(authenticate, authorize(ROLES.SELLER, ROLES.SELLER_STAFF));
  router.get('/alerts', route(async (req, res) => {
    const { data, meta } = await listSellerAlerts(sellerScope(req));
    return sendData(res, data, { meta });
  }));
  router.post('/alerts/:key/read', validate({ params: alertParams }), route(async (req, res) => sendData(res, await markSellerAlertRead(sellerScope(req), req.params.key))));
  return router;
}
