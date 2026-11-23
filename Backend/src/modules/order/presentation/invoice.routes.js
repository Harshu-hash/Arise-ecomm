import { Router } from 'express';
import { z } from 'zod';
import { recordAudit } from '../../../infrastructure/audit/audit.js';
import { ROLES } from '../../../shared/constants/roles.js';
import { sendData } from '../../../shared/http/respond.js';
import { validate } from '../../../shared/http/validate.js';
import { authenticate, authorize } from '../../../shared/middleware/authenticate.js';
import { requirePermission } from '../../../shared/middleware/permission.js';
import { sellerScope } from '../../../shared/policies/ownership.js';
import { objectIdSchema, pageQuery } from '../../../shared/validators/common.js';
import { getInvoiceById, getSellerInvoice, listInvoices, regenerateInvoice, sendPdf, signedInvoiceUrl } from '../application/invoice.service.js';
import { emailInvoiceLink } from '../application/orderNotifications.js';
import { Order } from '../infrastructure/persistence/order.model.js';

const TYPES = ['TAX_INVOICE', 'BILL_OF_SUPPLY', 'CREDIT_NOTE'];
const listQuery = pageQuery.extend({
  type: z.enum(TYPES).optional(),
  kind: z.enum(['GOODS', 'PLATFORM_FEE']).optional(),
  sellerId: z.string().max(40).optional(),
  from: z.string().max(40).optional(),
  to: z.string().max(40).optional(),
}).passthrough();
const idParams = z.object({ id: objectIdSchema });
const regenerateBody = z.object({ reason: z.string().trim().min(3, 'Say why this invoice is being re-generated.').max(300) }).strict();

const route = (handler) => async (req, res, next) => {
  try {
    return await handler(req, res);
  } catch (error) {
    return next(error);
  }
};

// Mounted at /api/seller/v1/finance/invoices: the seller's own invoices and credit notes.
export function createSellerInvoiceRouter() {
  const router = Router();
  router.use(authenticate, authorize(ROLES.SELLER, ROLES.SELLER_STAFF));
  router.get('/', validate({ query: listQuery }), route(async (req, res) => {
    const { data, meta } = await listInvoices(req.query, { sellerId: String(sellerScope(req)) });
    return sendData(res, data, { meta });
  }));
  router.get('/:id/pdf', validate({ params: idParams }), route(async (req, res) => sendPdf(res, await getSellerInvoice(sellerScope(req), { invoiceId: req.params.id }))));
  return router;
}

// Mounted at /api/admin/v1/invoices: every tax document on the platform.
export function createAdminInvoiceRouter() {
  const router = Router();
  router.use(authenticate, authorize(ROLES.ADMIN));
  router.get('/', requirePermission('finance.invoice.view'), validate({ query: listQuery }), route(async (req, res) => {
    const { data, meta } = await listInvoices(req.query);
    return sendData(res, data, { meta });
  }));
  router.get('/:id/pdf', requirePermission('finance.invoice.view'), validate({ params: idParams }), route(async (req, res) => sendPdf(res, await getInvoiceById(req.params.id))));
  router.post('/:id/regenerate', requirePermission('finance.invoice.regenerate'), validate({ params: idParams, body: regenerateBody }), route(async (req, res) => {
    const fresh = await regenerateInvoice(req.params.id, req.body.reason);
    await recordAudit({ action: 'invoice.regenerate', subjectType: 'invoice', subjectId: req.params.id, after: { replacedBy: String(fresh._id), number: fresh.number }, reason: req.body.reason, actor: { userId: req.auth.userId, role: req.auth.role } });
    return sendData(res, { id: String(fresh._id), number: fresh.number });
  }));
  router.post('/:id/resend', requirePermission('finance.invoice.view'), validate({ params: idParams }), route(async (req, res) => {
    const invoice = await getInvoiceById(req.params.id);
    await emailInvoiceLink(await Order.findById(invoice.orderId), invoice, signedInvoiceUrl(invoice._id, 7 * 86_400));
    return sendData(res, { sent: true });
  }));
  return router;
}
