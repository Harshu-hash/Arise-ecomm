import { Router } from 'express';
import { paymentGateway } from '../../../infrastructure/external/payment/index.js';
import { enqueueWebhookReceipt } from '../../../infrastructure/queue/webhook.queue.js';
import { RECEIPT_STATUS, WebhookReceipt } from '../../../infrastructure/webhooks/webhookReceipt.model.js';
import { UnauthorizedError, ValidationError } from '../../../shared/errors/AppError.js';
import { sendCommand } from '../../../shared/http/respond.js';

const PROVIDER = 'RAZORPAY';
const DUPLICATE_KEY = 11000;

export function createPaymentWebhookRouter() {
  const router = Router();

  // Order: verify signature on the raw bytes -> persist dedup receipt -> enqueue -> acknowledge fast.
  router.post('/razorpay', async (req, res, next) => {
    try {
      if (!paymentGateway.verifyWebhook(req.rawBody, req.get('x-razorpay-signature'))) {
        throw new UnauthorizedError('Invalid webhook signature.');
      }
      const providerEventId = req.get('x-razorpay-event-id');
      if (!providerEventId || typeof req.body?.event !== 'string') {
        throw new ValidationError('Webhook is missing its event id or event type.');
      }

      let receipt;
      try {
        receipt = await WebhookReceipt.create({
          provider: PROVIDER,
          providerEventId,
          eventType: req.body.event,
          payload: req.body,
        });
      } catch (error) {
        if (error?.code !== DUPLICATE_KEY) throw error;
        receipt = await WebhookReceipt.findOne({ provider: PROVIDER, providerEventId }, 'status').lean();
      }
      // A retry of an unprocessed event re-enqueues (same job id -> runs once); processed ones are just acknowledged.
      if (receipt && receipt.status !== RECEIPT_STATUS.PROCESSED) await enqueueWebhookReceipt(receipt._id);
      return sendCommand(res, { received: true });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
