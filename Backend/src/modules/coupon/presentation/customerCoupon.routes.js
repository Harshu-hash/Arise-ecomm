import { Router } from 'express';
import { ROLES } from '../../../shared/constants/roles.js';
import { sendData } from '../../../shared/http/respond.js';
import { optionalAuthenticate } from '../../../shared/middleware/authenticate.js';
import { listAvailableCoupons } from '../application/customerCoupon.service.js';

// Mounted at /api/customer/v1/coupons — anyone sees public coupons; a signed-in customer also sees the ones made for them.
export function createCustomerCouponRouter() {
  const router = Router();
  router.get('/available', optionalAuthenticate, async (req, res, next) => {
    try {
      const customerId = req.auth?.role === ROLES.CUSTOMER ? req.auth.userId : null;
      return sendData(res, await listAvailableCoupons(customerId));
    } catch (error) {
      return next(error);
    }
  });
  return router;
}
