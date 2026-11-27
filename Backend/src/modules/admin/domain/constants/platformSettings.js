// Platform settings are ten independently saved sections. These are the defaults served until
// an admin first saves a section; amounts are integer paise.
export const SETTINGS_SECTIONS = [
  {
    id: 'general',
    label: 'General',
    values: {
      platformName: 'Arise',
      logoUrl: '', // brand logo (a CMS upload); '' until one is uploaded
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
    // deliveryFeePaise is the flat delivery charge the cart shows until checkout has a real shipping quote (and charges if Shiprocket cannot be reached);
    // with flatDeliveryEnabled off the cart shows no delivery fee and a failed shipping quote fails checkout instead.
    values: { platformFeePaise: 500, flatDeliveryEnabled: true, deliveryFeePaise: 4000, deliveryFeeFreeThresholdPaise: 49_900, codConvenienceFeePaise: 1500 },
  },
  {
    id: 'payments',
    label: 'Payments',
    values: { enabledMethods: ['UPI', 'CARDS', 'NETBANKING', 'WALLET', 'COD'], codEnabled: true, walletUsageCapPct: 50 },
  },
  {
    id: 'homeHeader',
    label: 'Home header',
    // The colour the app's home header fades from when the "For You" tab is selected.
    values: { forYouColor: '#FFCB9D', forYouImage: '', forYouImageOpacity: 100, recentlyViewedTopColor: '#CFE3FF', recentlyViewedBottomColor: '#FFD9EC' }, // the last two: the "Still looking for these?" rail's gradient, top to bottom; // forYouImage: a CMS upload shown behind the header, '' for none
  },
  {
    id: 'referral',
    label: 'Refer & Earn',
    // Rewards are store credit in the customer's wallet, paid when the invited friend's first qualifying order is delivered.
    values: {
      enabled: false,
      referrerRewardPaise: 10_000,
      refereeRewardPaise: 5_000,
      minOrderPaise: 49_900,
      rewardExpiryDays: 90,
      maxRewardsPerReferrer: 20,
      autoApprove: false,
      terms: '',
    },
  },
  {
    id: 'tax',
    label: 'Tax',
    values: { invoiceSeriesPrefix: 'ARS', hsnDefaultRatePct: 18 },
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
    id: 'settlement',
    label: 'Seller settlement',
    // shortcut: tcsPct/tdsPct are the current statutory rates (GST s.52 on taxable value, income tax s.194-O); confirm with a tax advisor before launch
    values: {
      holdBufferDays: 2, closingFeePaise: 0, collectionFeePct: 0, gstOnFeesPct: 18, tcsPct: 0.5, tdsPct: 0.1,
      // withdrawals: set by admin, applied to every seller
      minWithdrawalPaise: 50_000, maxWithdrawalPaise: 5_000_000, dailyWithdrawalLimitPaise: 10_000_000, maxOpenWithdrawals: 1,
      newSellerDays: 90, // sellers approved less than this long ago keep sellerPolicies.reserveHoldPctNewSellers of their balance unwithdrawable
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
export const SENSITIVE_SETTINGS_SECTIONS = new Set(['fees', 'settlement', 'approvalThresholds', 'security']);
