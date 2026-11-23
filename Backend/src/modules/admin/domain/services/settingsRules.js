import { z } from 'zod';
import { paiseSchema } from '../../../../shared/validators/common.js';

const int = (min, max) => z.number().int().min(min).max(max);
const text = (max) => z.string().trim().min(1).max(max);
const pct = int(0, 100);
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM.');
const GSTIN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const ip = z.union([z.ipv4(), z.ipv6(), z.cidrv4(), z.cidrv6()]);

// Every field of a section must be present and valid after a patch is merged over the stored
// values, so one schema checks both the patch (strict: no unknown keys) and cross-field rules.
export const SECTION_SCHEMAS = {
  general: z.object({
    platformName: text(100),
    supportEmail: z.email().max(254),
    supportPhone: text(32),
    businessAddress: z.string().trim().max(300),
    legalEntityName: z.string().trim().max(200),
    gstins: z.array(z.object({ state: text(60), gstin: z.string().regex(GSTIN, 'Invalid GSTIN.') }).strict()).max(50),
  }).strict(),

  orders: z.object({
    paymentPendingTimeoutMins: int(1, 1440),
    sellerAcceptSlaHours: int(1, 720),
    dispatchSlaHoursSellerFulfilled: int(1, 720),
    dispatchSlaHoursFba: int(1, 720),
    autoCancelOnSlaBreach: z.boolean(),
    maxQtyPerOrder: int(1, 1000),
    codMinPaise: paiseSchema,
    codMaxPaise: paiseSchema,
    otpOnDeliveryAbovePaise: paiseSchema,
    otpOnDeliveryAll: z.boolean(),
  }).strict().refine((v) => v.codMinPaise <= v.codMaxPaise, { path: ['codMaxPaise'], message: 'Must be at least the COD minimum.' }),

  returns: z.object({
    defaultReturnWindowDays: int(0, 365),
    autoApproveBelowPaise: paiseSchema,
    refundTimingByTrustTier: z.object({ new: int(0, 60), standard: int(0, 60), trusted: int(0, 60) }).strict(),
  }).strict(),

  fees: z.object({
    platformFeePaise: paiseSchema,
    deliveryFeePaise: paiseSchema,
    deliveryFeeFreeThresholdPaise: paiseSchema,
    codConvenienceFeePaise: paiseSchema,
  }).strict(),

  payments: z.object({
    enabledMethods: z.array(z.enum(['UPI', 'CARDS', 'NETBANKING', 'WALLET', 'COD'])).min(1).max(5),
    codEnabled: z.boolean(),
    walletUsageCapPct: pct,
  }).strict(),

  tax: z.object({
    invoiceSeriesPrefix: z.string().trim().regex(/^[A-Z0-9]{1,4}$/, 'Use 1 to 4 letters or digits: GST allows invoice numbers of at most 16 characters.'),
    hsnDefaultRatePct: pct,
  }).strict(),

  sellerPolicies: z.object({
    tierGmvThresholdsPaise: z.object({ bronze: paiseSchema, silver: paiseSchema, gold: paiseSchema, platinum: paiseSchema }).strict(),
    payoutCycleDay: z.enum(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']),
    reserveHoldPctNewSellers: pct,
  }).strict(),

  settlement: z.object({
    holdBufferDays: int(0, 60), // extra days after the return window before a delivered item's money can be paid out
    closingFeePaise: paiseSchema, // flat fee per delivered item
    collectionFeePct: z.number().min(0).max(100), // payment collection cost, % of the sale
    gstOnFeesPct: z.number().min(0).max(100),
    tcsPct: z.number().min(0).max(100),
    tdsPct: z.number().min(0).max(100),
    minWithdrawalPaise: paiseSchema,
    maxWithdrawalPaise: paiseSchema, // per request
    dailyWithdrawalLimitPaise: paiseSchema, // per seller per day; 0 = no daily limit
    maxOpenWithdrawals: int(1, 20), // requests a seller may have waiting at once
    newSellerDays: int(0, 3650),
  }).strict().refine((v) => v.minWithdrawalPaise <= v.maxWithdrawalPaise, { path: ['maxWithdrawalPaise'], message: 'Must be at least the minimum withdrawal.' }),

  approvalThresholds: z.object({
    defaultRefundLimitPaise: paiseSchema,
    defaultWalletAdjustLimitPaise: paiseSchema,
    payoutAdjustThresholdPaise: paiseSchema,
    giftcardBatchThresholdPaise: paiseSchema,
  }).strict(),

  security: z.object({
    sessionIdleTimeoutMins: int(5, 1440),
    passwordMinLength: int(8, 64),
    passwordRequireSymbol: z.boolean(),
    ipAllowlist: z.array(ip).max(200),
    piiRevealAutoHideSeconds: int(5, 300),
  }).strict(),

  support: z.object({
    businessHoursStart: hhmm,
    businessHoursEnd: hhmm,
    holidays: z.array(z.iso.date()).max(366),
    autoCloseDaysAfterResolve: int(0, 30),
  }).strict(),
};
