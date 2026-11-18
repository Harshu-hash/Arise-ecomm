export const CAMPAIGN_TYPES = ['FLASH_DEAL', 'OFFER', 'SALE_EVENT', 'CLEARANCE'];
export const CUSTOMER_SECTIONS = ['FLASH_DEALS_RAIL', 'OFFERS_PAGE', 'TOP_VALUE_DEALS', 'SALE_LANDING', 'CATEGORY_SPOTLIGHT'];

export const CAMPAIGN_STATUS = Object.freeze({
  DRAFT: 'DRAFT',
  OPEN: 'OPEN',
  SCHEDULED: 'SCHEDULED',
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  ENDED: 'ENDED',
  CANCELLED: 'CANCELLED',
});

// The only legal moves; anything else is rejected centrally.
export const CAMPAIGN_TRANSITIONS = Object.freeze({
  DRAFT: ['OPEN'],
  OPEN: ['SCHEDULED', 'CANCELLED'],
  SCHEDULED: ['ACTIVE', 'CANCELLED'],
  ACTIVE: ['PAUSED', 'ENDED'],
  PAUSED: ['ACTIVE', 'ENDED'],
  ENDED: [],
  CANCELLED: [],
});

// Entries can be reviewed only while the campaign is collecting or running.
export const REVIEWABLE_STATUSES = ['OPEN', 'SCHEDULED', 'ACTIVE', 'PAUSED'];

export const SUBMISSION_STATUS = Object.freeze({
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  NEEDS_CHANGES: 'NEEDS_CHANGES',
  WITHDRAWN: 'WITHDRAWN',
});

export const SUBMISSION_DECISIONS = Object.freeze({
  approve: SUBMISSION_STATUS.APPROVED,
  reject: SUBMISSION_STATUS.REJECTED,
  changes: SUBMISSION_STATUS.NEEDS_CHANGES,
});
