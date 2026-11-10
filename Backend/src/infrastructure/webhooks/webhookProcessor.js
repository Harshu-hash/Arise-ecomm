import { RECEIPT_STATUS, WebhookReceipt } from './webhookReceipt.model.js';

const handlers = new Map(); // "PROVIDER:event.type" -> [{ name, handle }]

// Modules register at boot. Handlers MUST be idempotent and must not regress state on out-of-order events
// (compare provider timestamps / monotonic state before writing).
export function registerWebhookHandler(provider, eventType, name, handle) {
  const key = `${provider}:${eventType}`;
  const entries = handlers.get(key) ?? [];
  if (entries.some((entry) => entry.name === name)) throw new Error(`Duplicate webhook handler ${name} for ${key}`);
  handlers.set(key, [...entries, { name, handle }]);
}

export async function processReceipt(receiptId) {
  const receipt = await WebhookReceipt.findById(receiptId).lean();
  if (!receipt || receipt.status === RECEIPT_STATUS.PROCESSED) return receipt?.status ?? null;

  const entries = handlers.get(`${receipt.provider}:${receipt.eventType}`) ?? [];
  if (entries.length === 0) {
    await WebhookReceipt.updateOne({ _id: receipt._id }, { $set: { status: RECEIPT_STATUS.UNHANDLED } });
    return RECEIPT_STATUS.UNHANDLED;
  }

  try {
    await Promise.all(entries.map((entry) => entry.handle(receipt)));
  } catch (error) {
    await WebhookReceipt.updateOne(
      { _id: receipt._id },
      { $set: { status: RECEIPT_STATUS.FAILED, lastError: String(error?.message ?? error).slice(0, 2_000) }, $inc: { attempts: 1 } },
    );
    throw error; // lets BullMQ retry with backoff
  }
  await WebhookReceipt.updateOne(
    { _id: receipt._id },
    { $set: { status: RECEIPT_STATUS.PROCESSED, processedAt: new Date(), lastError: null }, $inc: { attempts: 1 } },
  );
  return RECEIPT_STATUS.PROCESSED;
}
