import { Router } from 'express';
import { z } from 'zod';
import { env } from '../../../config/env.js';
import { logger } from '../../../config/logger.js';
import { recordAudit } from '../../../infrastructure/audit/audit.js';
import { sendMail } from '../../../infrastructure/external/notification/mailer.js';
import { AppError, ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../../shared/errors/AppError.js';
import { sendCommand, sendData } from '../../../shared/http/respond.js';
import { validate } from '../../../shared/http/validate.js';
import { authenticate } from '../../../shared/middleware/authenticate.js';
import { requirePermission, userHasPermission } from '../../../shared/middleware/permission.js';
import { objectIdSchema } from '../../../shared/validators/common.js';
import { decryptField } from '../../../shared/utils/crypto.js';
import { signFileToken } from '../../../shared/utils/signedUrl.js';
import { Seller } from '../infrastructure/persistence/seller.model.js';
import { User } from '../infrastructure/persistence/user.model.js';

const decryptOrNull = (value) => (value ? decryptField(value) : null);

const DOCUMENT_TYPES = [
  { type: 'tradeLicense', label: 'Trade license', keyField: 'tradeLicenseKey' },
  { type: 'gstCertificate', label: 'GST certificate', keyField: 'gstCertificateKey' },
  { type: 'idProof', label: 'Owner ID proof', keyField: 'idProofKey' },
];

// The decision itself has already been saved by the time this runs — a flaky SMTP
// provider must not turn an already-successful approve/reject into an error response.
async function notify(mail) {
  try {
    await sendMail(mail);
  } catch (error) {
    logger.error({ err: error, to: mail.to }, 'Seller application notification email failed');
  }
}

function documentStatus(seller, type) {
  return seller.documentDecisions?.[type]?.status ?? 'PENDING';
}

// Shared by the review GET (to display) and the approve action (to enforce) — a decision
// made from stale blockers would approve an application that, by the time it's acted on,
// might no longer qualify.
function computeBlockers(seller) {
  return [
    ...DOCUMENT_TYPES.filter((d) => documentStatus(seller, d.type) !== 'APPROVED').map((d) => `${d.label} not approved`),
    ...(seller.gstinOk ? [] : ['GSTIN not verified']),
    ...(seller.panOk ? [] : ['PAN not verified']),
    ...(seller.bankOk ? [] : ['Bank account not verified']),
  ];
}

// TODO: once a dedicated "sellers" module exists, move this there — it lives in identity
// for now only because the Seller model physically does (see seller.model.js).

const SLA_HOURS = 48;
const OPEN_STATUSES = ['UNDER_REVIEW']; // statuses still awaiting a decision, for slaBreached
const SORT_FIELDS = { storeName: 'storeName', status: 'status', appliedAt: 'appliedAt', documentsApproved: 'documentsApproved' };

const listQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
    sort: z.string().optional(),
    q: z.string().trim().max(200).optional(),
    status: z.string().optional(),
    state: z.string().trim().max(100).optional(),
    slaBreached: z.enum(['true', 'false']).optional(),
  })
  .extend({ 'appliedAt[gte]': z.string().datetime().optional(), 'appliedAt[lte]': z.string().datetime().optional() });

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function parseSort(sort) {
  if (!sort) return { appliedAt: -1 };
  const desc = sort.startsWith('-');
  const field = SORT_FIELDS[desc ? sort.slice(1) : sort];
  if (!field) return { appliedAt: -1 };
  return { [field]: desc ? -1 : 1 };
}

function buildMatch(query) {
  const match = {};
  if (query.q) {
    const safe = escapeRegex(query.q);
    match.$or = [{ storeName: { $regex: safe, $options: 'i' } }, { legalName: { $regex: safe, $options: 'i' } }];
  }
  if (query.state) match['location.state'] = { $regex: `^${escapeRegex(query.state)}$`, $options: 'i' };

  const gte = query['appliedAt[gte]'];
  const lte = query['appliedAt[lte]'];
  if (gte || lte) {
    match.appliedAt = {};
    if (gte) match.appliedAt.$gte = new Date(gte);
    if (lte) match.appliedAt.$lte = new Date(lte);
  }

  if (query.slaBreached === 'true') {
    match.status = { $in: OPEN_STATUSES };
    match.appliedAt = { ...match.appliedAt, $lte: new Date(Date.now() - SLA_HOURS * 3_600_000) };
  }
  return match;
}

// Sellers that passed onboarding — the "All sellers" list, as opposed to /applications'
// still-under-review queue. Every perf/commercial field is a fixed 0/default (see the
// honest-defaults comment on the :id route); only storeName/status/tier/payoutOnHold/
// joinedAt carry real stored data, so those are the only ones worth indexing or sorting by.
const LIVE_STATUSES = ['APPROVED', 'ACTIVE', 'SUSPENDED'];
const SELLER_SORT_FIELDS = { storeName: 'storeName', status: 'status', tier: 'tier', joinedAt: 'approvedAt' };

const sellersListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
    sort: z.string().optional(),
    q: z.string().trim().max(200).optional(),
    status: z.string().optional(),
    tier: z.string().optional(),
    state: z.string().trim().max(100).optional(),
    payoutOnHold: z.enum(['true', 'false']).optional(),
  })
  .extend({ 'joinedAt[gte]': z.string().datetime().optional(), 'joinedAt[lte]': z.string().datetime().optional() });

function parseSellerSort(sort) {
  if (!sort) return { approvedAt: -1 };
  const desc = sort.startsWith('-');
  const field = SELLER_SORT_FIELDS[desc ? sort.slice(1) : sort];
  if (!field) return { approvedAt: -1 };
  return { [field]: desc ? -1 : 1 };
}

function buildSellersMatch(query) {
  const match = { status: { $in: LIVE_STATUSES } };
  if (query.q) {
    const safe = escapeRegex(query.q);
    // gstin is encrypted at rest (ciphertext), so a plaintext regex against it could never
    // match — it is deliberately left out rather than included as dead, misleading search.
    match.$or = [
      { storeName: { $regex: safe, $options: 'i' } },
      { legalName: { $regex: safe, $options: 'i' } },
      ...(/^[a-f\d]{24}$/i.test(query.q) ? [{ _id: query.q }] : []),
    ];
  }
  if (query.state) match['location.state'] = { $regex: `^${escapeRegex(query.state)}$`, $options: 'i' };
  if (query.payoutOnHold === 'true') match._id = null; // no payout-hold feature yet: always empty, never fabricated
  const gte = query['joinedAt[gte]'];
  const lte = query['joinedAt[lte]'];
  if (gte || lte) {
    match.approvedAt = {};
    if (gte) match.approvedAt.$gte = new Date(gte);
    if (lte) match.approvedAt.$lte = new Date(lte);
  }
  return match;
}

export function createSellerApplicationsRouter() {
  const router = Router();
  router.use(authenticate);

  // One aggregation covers the page of rows, the total count and the per-status tab
  // counts in a single round trip, instead of three separate queries.
  router.get('/applications', requirePermission('sellers.application.view'), validate({ query: listQuerySchema }), async (req, res, next) => {
    try {
      const query = req.query;
      const baseMatch = buildMatch(query);
      const statusFilter = query.status?.split(',').filter(Boolean);
      const statusMatch = statusFilter?.length ? [{ $match: { status: { $in: statusFilter } } }] : [];

      const [result] = await Seller.aggregate([
        { $match: baseMatch },
        {
          $facet: {
            rows: [
              ...statusMatch,
              { $sort: parseSort(query.sort) },
              { $skip: (query.page - 1) * query.pageSize },
              { $limit: query.pageSize },
              {
                $project: {
                  _id: 0,
                  id: { $toString: '$_id' },
                  storeName: 1,
                  city: '$location.city',
                  state: '$location.state',
                  gstin: 1,
                  gstinOk: 1,
                  panOk: 1,
                  bankOk: 1,
                  documentsApproved: {
                    $size: {
                      $filter: {
                        input: [
                          '$documentDecisions.tradeLicense.status',
                          '$documentDecisions.gstCertificate.status',
                          '$documentDecisions.idProof.status',
                        ],
                        cond: { $eq: ['$$this', 'APPROVED'] },
                      },
                    },
                  },
                  documentsTotal: { $literal: 3 },
                  status: 1,
                  appliedAt: 1,
                  slaDueAt: { $add: ['$appliedAt', SLA_HOURS * 3_600_000] },
                  blockerCount: {
                    $add: [
                      {
                        $subtract: [
                          3,
                          {
                            $size: {
                              $filter: {
                                input: [
                                  '$documentDecisions.tradeLicense.status',
                                  '$documentDecisions.gstCertificate.status',
                                  '$documentDecisions.idProof.status',
                                ],
                                cond: { $eq: ['$$this', 'APPROVED'] },
                              },
                            },
                          },
                        ],
                      },
                      { $cond: ['$gstinOk', 0, 1] },
                      { $cond: ['$panOk', 0, 1] },
                      { $cond: ['$bankOk', 0, 1] },
                    ],
                  },
                },
              },
            ],
            total: [...statusMatch, { $count: 'n' }],
            statusCounts: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
          },
        },
      ]);

      const facets = { status: Object.fromEntries((result?.statusCounts ?? []).map((s) => [s._id, s.count])) };
      return sendData(res, result?.rows ?? [], { meta: { total: result?.total?.[0]?.n ?? 0, facets } });
    } catch (error) {
      return next(error);
    }
  });

  // "All sellers" — everyone past onboarding. Same single-aggregation shape as
  // /applications: one round trip for the page, the total and the status tab counts.
  router.get('/', requirePermission('sellers.seller.view'), validate({ query: sellersListQuerySchema }), async (req, res, next) => {
    try {
      const query = req.query;
      const baseMatch = buildSellersMatch(query);
      const extra = [];
      if (query.status?.trim()) extra.push({ $match: { status: { $in: query.status.split(',').filter(Boolean) } } });
      if (query.tier?.trim()) extra.push({ $match: { tier: { $in: query.tier.split(',').filter(Boolean) } } });

      const [result] = await Seller.aggregate([
        { $match: baseMatch },
        {
          $facet: {
            rows: [
              ...extra,
              { $sort: parseSellerSort(query.sort) },
              { $skip: (query.page - 1) * query.pageSize },
              { $limit: query.pageSize },
              {
                $project: {
                  _id: 0,
                  id: { $toString: '$_id' },
                  storeName: 1,
                  city: '$location.city',
                  state: '$location.state',
                  status: 1,
                  tier: { $ifNull: ['$tier', 'BRONZE'] },
                  rating: { $literal: null },
                  liveListings: { $literal: 0 },
                  gmv30dPaise: { $literal: 0 },
                  orders30d: { $literal: 0 },
                  cancellationPct: { $literal: 0 },
                  lateDispatchPct: { $literal: 0 },
                  returnPct: { $literal: 0 },
                  payoutOnHold: { $literal: false },
                  joinedAt: '$approvedAt',
                },
              },
            ],
            total: [...extra, { $count: 'n' }],
            statusCounts: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
          },
        },
      ]);

      const facets = { status: Object.fromEntries((result?.statusCounts ?? []).map((s) => [s._id, s.count])) };
      return sendData(res, result?.rows ?? [], { meta: { total: result?.total?.[0]?.n ?? 0, facets } });
    } catch (error) {
      return next(error);
    }
  });

  // The review workbench: everything about one application on one screen. Several
  // sections (GSTIN/PAN verification, bank penny-drop, pickup courier serviceability,
  // category gating, duplicate detection) have no backing integration yet — those come
  // back as honest empty/unverified states rather than fabricated data.
  router.get('/:id', validate({ params: z.object({ id: objectIdSchema }) }), async (req, res, next) => {
    try {
      // Shared by the application-review page and the full seller page, so either
      // permission is enough — a seller account manager with only sellers.seller.view
      // still needs to open an approved seller's page.
      const [canViewApplication, canViewSeller] = await Promise.all([
        userHasPermission(req.auth.userId, 'sellers.application.view'),
        userHasPermission(req.auth.userId, 'sellers.seller.view'),
      ]);
      if (!canViewApplication && !canViewSeller) throw new ForbiddenError();

      const seller = await Seller.findById(req.params.id).lean();
      if (!seller) throw new NotFoundError('This application no longer exists.');
      const [owner, canViewBank] = await Promise.all([
        User.findOne({ sellerId: req.params.id, role: 'SELLER' }, 'email phone').lean(),
        userHasPermission(req.auth.userId, 'sellers.bank.view_full'),
      ]);

      const documents = DOCUMENT_TYPES.map(({ type, label, keyField }) => {
        const key = seller.documents?.[keyField];
        if (!key) return null;
        const [, folder, ownerId, file] = key.split('/');
        const url = `${env.PUBLIC_ORIGIN}/api/admin/v1/uploads/private/${folder}/${ownerId}/${file}?token=${signFileToken(key)}`;
        return {
          id: type,
          label,
          mimeType: file.endsWith('.pdf') ? 'application/pdf' : `image/${file.split('.').pop()}`,
          fileName: file,
          uploadedAt: seller.appliedAt,
          status: documentStatus(seller, type),
          rejectionReason: seller.documentDecisions?.[type]?.reason ?? null,
          previewUrl: url,
          downloadUrl: url,
        };
      }).filter(Boolean);

      const blockers = computeBlockers(seller);
      const isOpen = OPEN_STATUSES.includes(seller.status);

      return sendData(
        res,
        {
          id: String(seller._id),
          storeName: seller.storeName,
          legalName: seller.legalName,
          status: seller.status,
          appliedAt: seller.appliedAt,
          city: seller.location?.city,
          state: seller.location?.state,
          pincode: seller.location?.pincode,
          contactEmail: owner?.email ?? null,
          contactPhone: owner?.phone ?? null,
          gstin: decryptOrNull(seller.gstin), // business data, not PII — always shown (mask.js)
          gstinOk: seller.gstinOk,
          pan: decryptOrNull(seller.pan),
          panOk: seller.panOk,
          bankOk: seller.bankOk,
          rejectionReason: seller.rejectionReason,
          infoRequested: seller.infoRequested ?? [],
          // "Full seller account" fields (SellerDetailPage, once approved): no seller/catalog/
          // finance module exists yet to back tiering, performance or lifecycle holds, so a
          // freshly-approved seller honestly shows zero activity rather than invented numbers.
          tier: seller.tier ?? 'BRONZE',
          rating: null,
          gmv30dPaise: 0,
          orders30d: 0,
          cancellationPct: 0,
          lateDispatchPct: 0,
          returnPct: 0,
          payoutOnHold: false,
          suspensionReason: null,
          joinedAt: seller.approvedAt ?? null,
          accountManagerName: null,
          commissionPlan: null,
          payoutCycle: null,
          fulfillmentTypes: ['SELLER'],
          businessType: null,
        },
        {
          meta: {
            documents,
            addresses: seller.location
              ? [
                  {
                    id: 'primary',
                    line1: seller.location.address,
                    line2: seller.location.locality,
                    city: seller.location.city,
                    state: seller.location.state,
                    pincode: seller.location.pincode,
                    contactName: seller.ownerName,
                    contactPhone: owner?.phone ?? null,
                    serviceableCouriers: [], // no logistics integration yet
                    geoVerified: false,
                  },
                ]
              : [],
            // The account number only decrypts for a viewer holding sellers.bank.view_full;
            // everyone else gets the same digits MaskedValue would show anyway, so a reveal
            // click is a no-op rather than a real disclosure.
            bank: seller.bank?.accountNumber
              ? {
                  accountHolder: seller.bank.accountHolder,
                  accountNumber: canViewBank
                    ? decryptOrNull(seller.bank.accountNumber)
                    : decryptOrNull(seller.bank.accountNumber).replace(/\d(?=\d{4})/g, '•'),
                  ifsc: seller.bank.ifsc,
                  // No penny-drop/name-match/IFSC-lookup integration yet. `undefined` (not
                  // null) for nameMatchPct: VerificationPanel compares it with `< 95`, where
                  // `null` coerces to 0 and would wrongly flag every account as mismatched.
                  pennyDropStatus: seller.bankOk ? 'VERIFIED' : 'PENDING',
                  nameMatchPct: undefined,
                  bankName: '',
                  branch: '',
                }
              : null,
            blockers: isOpen ? blockers : [],
            allowedActions: isOpen ? ['APPROVE', 'REJECT', 'REQUEST_INFO'] : [],
            duplicates: [], // no dedupe check implemented yet
            categories: [], // no catalog/category selection in the registration flow yet
            // SellerDetailPage's tabs (listings, penalties, claims, notes, brand requests,
            // identity-change requests) — none of those modules exist yet either.
            counts: { liveOffers: 0, products: 0, offers: 0, openPenalties: 0, openClaims: 0 },
            penalties: [],
            claims: [],
            notes: [],
            brandRequests: [],
            changeRequests: [],
          },
        },
      );
    } catch (error) {
      return next(error);
    }
  });

  const VERIFY_FIELDS = { gstin: 'gstinOk', pan: 'panOk', bank: 'bankOk' };
  const verifySchema = z.object({ field: z.enum(Object.keys(VERIFY_FIELDS)), ok: z.boolean() });

  // Manual KYC check: Arise has no GSTIN/PAN/bank verification provider, so this records a
  // reviewer's own judgement after checking the value against the uploaded documents — not
  // an automated result.
  router.post(
    '/:id/verify',
    requirePermission('sellers.kyc.verify'),
    validate({ params: z.object({ id: objectIdSchema }), body: verifySchema }),
    async (req, res, next) => {
      try {
        const { field, ok } = req.body;
        const flag = VERIFY_FIELDS[field];
        const seller = await Seller.findByIdAndUpdate(req.params.id, { $set: { [flag]: ok } }, { new: true }).lean();
        if (!seller) throw new NotFoundError('This application no longer exists.');

        await recordAudit({
          action: 'seller.kyc.verify',
          subjectType: 'seller',
          subjectId: req.params.id,
          after: { field, ok },
          actor: { userId: req.auth.userId, role: req.auth.role },
        });

        return sendData(res, { [flag]: seller[flag] });
      } catch (error) {
        return next(error);
      }
    },
  );

  const decideDocumentSchema = z.object({ approve: z.boolean(), reason: z.string().trim().max(500).optional() });

  router.post(
    '/:id/documents/:docId/decide',
    requirePermission('sellers.kyc.verify'),
    validate({
      params: z.object({ id: objectIdSchema, docId: z.enum(DOCUMENT_TYPES.map((d) => d.type)) }),
      body: decideDocumentSchema,
    }),
    async (req, res, next) => {
      try {
        const { id, docId } = req.params;
        const { approve, reason } = req.body;
        if (!approve && !reason) {
          throw new ValidationError('Give a reason so the seller can fix it.', { reason: ['Required when rejecting.'] });
        }

        const status = approve ? 'APPROVED' : 'REJECTED';
        const seller = await Seller.findByIdAndUpdate(
          id,
          {
            $set: {
              [`documentDecisions.${docId}.status`]: status,
              [`documentDecisions.${docId}.reason`]: approve ? null : reason,
            },
          },
          { new: true },
        ).lean();
        if (!seller) throw new NotFoundError('This application no longer exists.');

        await recordAudit({
          action: 'seller.document.decide',
          subjectType: 'seller',
          subjectId: id,
          after: { docId, status, reason: approve ? null : reason },
          actor: { userId: req.auth.userId, role: req.auth.role },
        });

        return sendData(res, { docId, status });
      } catch (error) {
        return next(error);
      }
    },
  );

  const DECISIONS = ['approve', 'reject', 'request-info'];
  const DECISION_PERMISSION = {
    approve: 'sellers.application.approve',
    reject: 'sellers.application.reject',
    'request-info': 'sellers.application.request_info',
  };
  const decideApplicationSchema = z.object({
    reason: z.string().trim().max(1000).optional(),
    items: z.array(z.string().trim().min(1)).optional(),
  });

  // Approve/reject/request-info on the application itself. Approval re-checks blockers
  // against the CURRENT state server-side (not whatever the browser last loaded) —
  // otherwise a stale page could approve an application that no longer qualifies.
  router.post(
    '/:id/application/:decision',
    validate({ params: z.object({ id: objectIdSchema, decision: z.enum(DECISIONS) }), body: decideApplicationSchema }),
    async (req, res, next) => {
      try {
        const { id, decision } = req.params;
        const { reason, items } = req.body;
        if (!(await userHasPermission(req.auth.userId, DECISION_PERMISSION[decision]))) throw new ForbiddenError();

        const seller = await Seller.findById(id);
        if (!seller) throw new NotFoundError('This application no longer exists.');
        if (!OPEN_STATUSES.includes(seller.status)) {
          throw new ConflictError('ALREADY_DECIDED', 'This application has already been decided.');
        }
        const owner = await User.findOne({ sellerId: id, role: 'SELLER' }, 'email').lean();

        if (decision === 'approve') {
          const blockers = computeBlockers(seller);
          if (blockers.length) {
            throw new AppError({
              code: 'APPROVAL_BLOCKED',
              status: 422,
              message: 'This application is not ready to be approved.',
              details: { blockers },
            });
          }
          seller.status = 'APPROVED';
          seller.approvedAt = new Date();
          await seller.save();
          // The Seller aggregate's status is what actually gates login (see
          // auth.service's assertSellerIsLive); this just keeps the owner's own
          // account status consistent with it.
          await User.updateMany({ sellerId: id, role: 'SELLER' }, { $set: { status: 'ACTIVE' } });
          if (owner?.email) {
            await notify({
              to: owner.email,
              subject: 'Your Arise seller application has been approved',
              text: `Good news — ${seller.storeName} has been approved. Sign in to finish setting up your account: ${env.PUBLIC_ORIGIN}/seller/login`,
            });
          }
        } else if (decision === 'reject') {
          if (!reason) throw new ValidationError('Give a reason the applicant will see.', { reason: ['Required'] });
          seller.status = 'REJECTED';
          seller.rejectionReason = reason;
          await seller.save();
          if (owner?.email) {
            await notify({
              to: owner.email,
              subject: 'Your Arise seller application was not approved',
              text: `Your application for ${seller.storeName} was not approved.\n\nReason: ${reason}\n\nYou may reapply after 30 days.`,
            });
          }
        } else {
          if (!items?.length) throw new ValidationError('Pick at least one item.', { items: ['Required'] });
          seller.infoRequested = items;
          await seller.save();
        }

        await recordAudit({
          action: `seller.application.${decision}`,
          subjectType: 'seller',
          subjectId: id,
          after: { decision, reason: reason ?? null, items: items ?? null },
          actor: { userId: req.auth.userId, role: req.auth.role },
        });

        return sendCommand(res, { status: seller.status });
      } catch (error) {
        return next(error);
      }
    },
  );

  return router;
}
