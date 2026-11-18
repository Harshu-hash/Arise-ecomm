// Platform settings are ten independently saved sections. These are the defaults served until
// an admin first saves a section; amounts are integer paise.
export const SETTINGS_SECTIONS = [
  {
    id: 'general',
    label: 'General',
    values: {
      platformName: 'Arise',
      supportEmail: 'support@arise.test',
      supportPhone: '1800-123-4567',
      businessAddress: '',
      legalEntityName: '',
      gstins: [],
    },
  },
  {
    id: 'orders',
    label: 'Order settings',
    values: {
      paymentPendingTimeoutMins: 30,
      sellerAcceptSlaHours: 24,
      dispatchSlaHoursSellerFulfilled: 48,
      dispatchSlaHoursFba: 24,
      autoCancelOnSlaBreach: true,
      maxQtyPerOrder: 10,
      codMinPaise: 0,
      codMaxPaise: 500_000,
      otpOnDeliveryAbovePaise: 200_000,
      otpOnDeliveryAll: false,
    },
  },
  {
    id: 'returns',
    label: 'Return policies',
    values: {
      defaultReturnWindowDays: 7,
      autoApproveBelowPaise: 50_000,
      refundTimingByTrustTier: { new: 7, standard: 3, trusted: 1 },
    },
  },
  {
    id: 'fees',
    label: 'Fees',
    values: { platformFeePaise: 500, deliveryFeeFreeThresholdPaise: 49_900, codConvenienceFeePaise: 1500 },
  },
  {
    id: 'payments',
    label: 'Payments',
    values: { enabledMethods: ['UPI', 'CARDS', 'NETBANKING', 'WALLET', 'COD'], codEnabled: true, walletUsageCapPct: 50 },
  },
  {
    id: 'tax',
    label: 'Tax',
    values: { invoiceSeriesPrefix: 'ARS/INV', hsnDefaultRatePct: 18 },
  },
  {
    id: 'sellerPolicies',
    label: 'Seller policies',
    values: {
      tierGmvThresholdsPaise: { bronze: 0, silver: 50_000_000, gold: 250_000_000, platinum: 1_000_000_000 },
      payoutCycleDay: 'MONDAY',
      reserveHoldPctNewSellers: 10,
    },
  },
  {
    id: 'approvalThresholds',
    label: 'Approval thresholds',
    values: {
      defaultRefundLimitPaise: 1_000_000,
      defaultWalletAdjustLimitPaise: 50_000,
      payoutAdjustThresholdPaise: 1_000_000,
      giftcardBatchThresholdPaise: 10_000_000,
    },
  },
  {
    id: 'security',
    label: 'Security',
    values: {
      sessionIdleTimeoutMins: 30,
      passwordMinLength: 10,
      passwordRequireSymbol: true,
      ipAllowlist: [],
      piiRevealAutoHideSeconds: 20,
    },
  },
  {
    id: 'support',
    label: 'Support',
    values: {
      businessHoursStart: '09:00',
      businessHoursEnd: '21:00',
      holidays: [],
      autoCloseDaysAfterResolve: 3,
    },
  },
];

export const SETTINGS_SECTION_IDS = SETTINGS_SECTIONS.map((section) => section.id);

// Changing these affects money or access platform-wide, so a reason is mandatory and audited.
export const SENSITIVE_SETTINGS_SECTIONS = new Set(['fees', 'approvalThresholds', 'security']);
