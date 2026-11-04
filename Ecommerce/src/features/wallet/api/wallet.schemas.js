import { z } from 'zod';
import { apiEnvelope } from '@features/auth/api/auth.schemas';
export const walletDtoSchema = z.object({
  currency: z.literal('INR'),
  availableBalancePaise: z.number().int().nonnegative(),
  pendingBalancePaise: z.number().int().nonnegative(),
  expiryBuckets: z.array(
    z.object({ amountPaise: z.number().int().positive(), expiresAt: z.string().datetime() }),
  ),
  updatedAt: z.string().datetime(),
});
export const walletResponseSchema = apiEnvelope(walletDtoSchema);
export const transactionSchema = z.object({
  id: z.string().min(1),
  direction: z.enum(['CREDIT', 'DEBIT']),
  type: z.enum(['REFUND', 'CASHBACK', 'GIFT_CARD', 'REFERRAL', 'ORDER_PAYMENT', 'ADJUSTMENT']),
  title: z.string().min(1),
  reference: z.string().nullable(),
  amountPaise: z.number().int().positive(),
  status: z.enum(['PENDING', 'COMPLETED', 'REVERSED']),
  occurredAt: z.string().datetime(),
  balanceAfterPaise: z.number().int().nonnegative(),
});
export const transactionsResponseSchema = apiEnvelope(
  z.object({
    items: z.array(transactionSchema),
    total: z.number().int().nonnegative(),
    nextCursor: z.string().nullable(),
  }),
);
export const giftCardResponseSchema = apiEnvelope(
  z.object({ transaction: transactionSchema, wallet: walletDtoSchema }),
);
export const referralResponseSchema = apiEnvelope(
  z.object({
    code: z.string().min(1),
    shareUrl: z.string().url(),
    shareMessage: z.string().min(1),
    rewardAmountPaise: z.number().int().nonnegative(),
    successfulReferrals: z.number().int().nonnegative(),
    earnedAmountPaise: z.number().int().nonnegative(),
    termsSummary: z.string().min(1),
  }),
);
