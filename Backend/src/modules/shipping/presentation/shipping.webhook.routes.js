import { timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import { env } from '../../../config/env.js';
import { enqueueWebhookReceipt } from '../../../infrastructure/queue/webhook.queue.js';
import { RECEIPT_STATUS, WebhookReceipt } from '../../../infrastructure/webhooks/webhookReceipt.model.js';
import { UnauthorizedError, ValidationError } from '../../../shared/errors/AppError.js';
import { sendCommand } from '../../../shared/http/respond.js';

export const SHIPROCKET = 'SHIPROCKET';
export const TRACKING_EVENT = 'shipment.tracking';
const DUPLICATE_KEY = 11000;

// Shiprocket has no signature: it sends the token you set in its dashboard as the x-api-key header.
function tokenMatches(received) {
  const expected = Buffer.from(env.SHIPROCKET_WEBHOOK_TOKEN ?? '', 'utf8');
  const given = Buffer.from(String(received ?? ''), 'utf8');
  return expected.length > 0 && expected.length === given.length && timingSafeEqual(expected, given);
}

export function createShippingWebhookRouter() {
  const router = Router();

  // Same order as payments: check the token -> persist a dedup receipt -> enqueue -> acknowledge fast.
  router.post('/shiprocket', async (req, res, next) => {
    try {
      if (!tokenMatches(req.get('x-api-key'))) throw new UnauthorizedError('Invalid webhook token.');
      const { awb, current_status: status, current_status_id: statusId, current_timestamp: at } = req.body ?? {};
      if (!awb || !status) throw new ValidationError('Webhook is missing its tracking number or status.');

      let receipt;
      try {
        receipt = await WebhookReceipt.create({ provider: SHIPROCKET, providerEventId: `${awb}:${statusId ?? status}:${at ?? ''}`, eventType: TRACKING_EVENT, payload: req.body });
      } catch (error) {
        if (error?.code !== DUPLICATE_KEY) throw error;
        receipt = await WebhookReceipt.findOne({ provider: SHIPROCKET, providerEventId: `${awb}:${statusId ?? status}:${at ?? ''}` }, 'status').lean();
      }
      if (receipt && receipt.status !== RECEIPT_STATUS.PROCESSED) await enqueueWebhookReceipt(receipt._id);
      return sendCommand(res, { received: true });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
