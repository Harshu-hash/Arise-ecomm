import { Router } from 'express';
import { z } from 'zod';
import { ROLES } from '../../../shared/constants/roles.js';
import { sendCommand, sendData } from '../../../shared/http/respond.js';
import { validate } from '../../../shared/http/validate.js';
import { authenticate, authorize } from '../../../shared/middleware/authenticate.js';
import { objectIdSchema } from '../../../shared/validators/common.js';
import {
  createAddress,
  deleteAddress,
  getServiceability,
  listAddresses,
  makeDefaultAddress,
  updateAddress,
  validateAddress,
} from '../application/address.service.js';

const fields = {
  label: z.enum(['Home', 'Work', 'Other'], { error: 'Choose an address type.' }),
  isDefault: z.boolean(),
  name: z.string().trim().min(2, 'Enter the recipient name.').max(80),
  phone: z.string().trim().regex(/^\+?[0-9 ]{10,16}$/, 'Enter a valid mobile number.'),
  line: z.string().trim().min(5, 'Enter the complete street address.').max(300),
  city: z.string().trim().min(2, 'Enter the city.').max(100),
  state: z.string().trim().min(2, 'Enter the state.').max(100),
  pincode: z.string().trim().regex(/^[1-9][0-9]{5}$/, 'Enter a valid 6-digit pincode.'),
};
const addressBody = z.object({ ...fields, isDefault: fields.isDefault.default(false) }).strict();
const addressPatch = z.object(fields).partial().strict().refine((body) => Object.keys(body).length > 0, {
  message: 'Provide at least one address field.',
});
const addressParams = z.object({ addressId: objectIdSchema });
const serviceabilityQuery = z.object({ pincode: fields.pincode }).strict();

const route = (handler) => async (req, res, next) => {
  try {
    return await handler(req, res);
  } catch (error) {
    return next(error);
  }
};

export function createCustomerAddressRouter() {
  const router = Router();
  const customerOnly = [authenticate, authorize(ROLES.CUSTOMER)];

  router.get('/addresses', ...customerOnly, route(async (req, res) => sendData(res, await listAddresses(req.auth.userId))));
  router.post('/addresses/validate', ...customerOnly, validate({ body: addressBody }), route(async (req, res) =>
    sendCommand(res, await validateAddress(req.body))));
  router.post('/addresses', ...customerOnly, validate({ body: addressBody }), route(async (req, res) =>
    sendCommand(res, await createAddress(req.auth.userId, req.body), { status: 201 })));
  router.patch('/addresses/:addressId', ...customerOnly, validate({ params: addressParams, body: addressPatch }), route(async (req, res) =>
    sendCommand(res, await updateAddress(req.auth.userId, req.params.addressId, req.body))));
  router.delete('/addresses/:addressId', ...customerOnly, validate({ params: addressParams }), route(async (req, res) =>
    sendCommand(res, await deleteAddress(req.auth.userId, req.params.addressId))));
  router.post('/addresses/:addressId/default', ...customerOnly, validate({ params: addressParams }), route(async (req, res) =>
    sendCommand(res, await makeDefaultAddress(req.auth.userId, req.params.addressId))));
  router.get('/serviceability', ...customerOnly, validate({ query: serviceabilityQuery }), route(async (req, res) =>
    sendData(res, await getServiceability(req.query.pincode))));

  return router;
}
