import { z } from 'zod';
import { apiEnvelope } from '@features/auth/api/auth.schemas';
import { addressDtoSchema } from '@features/address/api/address.schemas';

const checkoutLineSchema = z.object({
  lineId: z.string().min(1),
  productId: z.string().min(1),
  name: z.string().min(1),
  imageUrl: z.string().url(),
  variantLabel: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPricePaise: z.number().int().nonnegative(),
  mrpPaise: z.number().int().positive(),
  lineTotalPaise: z.number().int().nonnegative(),
  sellerId: z.string().min(1),
  sellerName: z.string().min(1),
  deliveryPromise: z.string().min(1),
});
const checkoutTotalsSchema = z.object({
  mrpPaise: z.number().int().nonnegative(),
  subtotalPaise: z.number().int().nonnegative(),
  productDiscountPaise: z.number().int().nonnegative(),
  couponDiscountPaise: z.number().int().nonnegative(),
  deliveryFeePaise: z.number().int().nonnegative(),
  platformFeePaise: z.number().int().nonnegative(),
  taxPaise: z.number().int().nonnegative(),
  walletCreditPaise: z.number().int().nonnegative(),
  payablePaise: z.number().int().nonnegative(),
});
export const checkoutSessionSchema = z.object({
  id: z.string().min(1),
  status: z.enum(['READY', 'BLOCKED', 'EXPIRED', 'COMPLETED']),
  source: z.enum(['CART', 'BUY_NOW']),
  cartVersion: z.number().int().nonnegative().nullable(),
  address: addressDtoSchema,
  lines: z.array(checkoutLineSchema).min(1),
  totals: checkoutTotalsSchema,
  couponCode: z.string().nullable(),
  allowedPaymentMethods: z.array(z.enum(['upi', 'card', 'cod', 'wallet'])).min(1),
  selectedPaymentMethod: z.enum(['upi', 'card', 'cod', 'wallet']).nullable(),
  codEligible: z.boolean(),
  expiresAt: z.string().datetime(),
  warnings: z.array(z.string()),
  blockers: z.array(z.string()),
});
export const checkoutSessionResponseSchema = apiEnvelope(checkoutSessionSchema);
