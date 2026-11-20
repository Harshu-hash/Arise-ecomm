import { rm } from 'node:fs/promises';
import { resolveKey } from '../../../infrastructure/storage/local.storage.js';
import { anonymizeCustomerIdentity, assertActiveCustomer } from '../../identity/public/index.js';
import { deleteCustomerProductHistory } from '../../product/public/index.js';
import { AccountDeletion } from '../infrastructure/persistence/accountDeletion.model.js';
import { AddressBook } from '../infrastructure/persistence/addressBook.model.js';

const COOLING_OFF_MS = 7 * 24 * 60 * 60_000;
const CLAIM_TIMEOUT_MS = 15 * 60_000;
const PROCESS_LIMIT = 100;

const serializeRequest = (request) => request
  ? {
      id: String(request._id),
      status: request.status,
      requestedAt: request.requestedAt.toISOString(),
      scheduledDeletionAt: request.scheduledDeletionAt?.toISOString() ?? null,
    }
  : null;

// shortcut: no order/return/refund/wallet aggregates exist yet; add their real blockers when those modules land.
const blockersFor = async () => [];

export async function getDeletionEligibility(customerId) {
  await assertActiveCustomer(customerId);
  const [blockers, request] = await Promise.all([
    blockersFor(customerId),
    AccountDeletion.findOne({ customerId }).lean(),
  ]);
  return { eligible: blockers.length === 0, blockers, existingRequest: serializeRequest(request) };
}

export async function createDeletionRequest(customerId, { reasonCode }, now = new Date()) {
  const eligibility = await getDeletionEligibility(customerId);
  if (eligibility.existingRequest) return eligibility;
  const request = await AccountDeletion.findOneAndUpdate(
    { customerId },
    {
      $setOnInsert: {
        customerId,
        reasonCode,
        status: 'SCHEDULED',
        requestedAt: now,
        scheduledDeletionAt: new Date(now.getTime() + COOLING_OFF_MS),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  return { ...eligibility, existingRequest: serializeRequest(request) };
}

async function completeDeletion(request) {
  const customerId = String(request.customerId);
  await Promise.all([
    anonymizeCustomerIdentity(customerId),
    AddressBook.deleteOne({ customerId }),
    deleteCustomerProductHistory(customerId),
    rm(resolveKey(`public/avatars/${customerId}`), { recursive: true, force: true }),
  ]);
  await AccountDeletion.updateOne(
    { _id: request._id, status: 'SCHEDULED' },
    { $set: { status: 'COMPLETED', completedAt: new Date() }, $unset: { processingAt: '' } },
  );
}

export async function processDueAccountDeletions(now = new Date()) {
  let completed = 0;
  for (; completed < PROCESS_LIMIT; completed += 1) {
    const request = await AccountDeletion.findOneAndUpdate(
      {
        status: 'SCHEDULED',
        scheduledDeletionAt: { $lte: now },
        $or: [
          { processingAt: null },
          { processingAt: { $lt: new Date(now.getTime() - CLAIM_TIMEOUT_MS) } },
        ],
      },
      { $set: { processingAt: now } },
      { sort: { scheduledDeletionAt: 1 }, new: true },
    );
    if (!request) break;
    try {
      await completeDeletion(request);
    } catch (error) {
      await AccountDeletion.updateOne(
        { _id: request._id, status: 'SCHEDULED' },
        { $unset: { processingAt: '' } },
      );
      throw error;
    }
  }
  return { completed };
}
