import { Router } from 'express';
import { z } from 'zod';
import { env } from '../../../config/env.js';
import { NotFoundError } from '../../../shared/errors/AppError.js';
import { ROLES } from '../../../shared/constants/roles.js';
import { sendData } from '../../../shared/http/respond.js';
import { validate } from '../../../shared/http/validate.js';
import { authenticate, authorize } from '../../../shared/middleware/authenticate.js';
import { createRateLimiter } from '../../../shared/middleware/rateLimit.js';
import { requireStepUp } from '../../../shared/middleware/stepUp.js';
import { sellerScope } from '../../../shared/policies/ownership.js';
import { decryptField } from '../../../shared/utils/crypto.js';
import { signFileToken } from '../../../shared/utils/signedUrl.js';
import { accountNumberSchema, ifscSchema } from '../../../shared/validators/common.js';
import { clearBank, getBank, getPickupAddress, logoUrlOf, setPickupAddress, setGstin, issueStepUpToken, setBank, setVacationMode, updateProfile } from '../application/sellerSettings.service.js';
import { Seller } from '../infrastructure/persistence/seller.model.js';

const profileBody = z.object({ storeName: z.string().trim().min(2).max(120), logoKey: z.string().max(300).nullable().optional() });
const gstinBody = z.object({ gstin: z.string().trim().toUpperCase().regex(/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, 'Enter a valid 15-character GSTIN.').nullable() }).strict();
const vacationBody = z.object({ on: z.boolean() });
// The courier refuses a first line under 10 characters or without a house, flat or road number, so ask for that here.
const addressBody = z.object({
  address: z.string().trim().min(10, 'Enter the full address: house or flat number, building and road (at least 10 characters).').max(200).regex(/\d/, 'Include a house, flat or road number.'),
  locality: z.string().trim().max(100).default(''),
  city: z.string().trim().min(2, 'Enter the city.').max(80),
  state: z.string().trim().min(2, 'Enter the state.').max(80),
  pincode: z.string().trim().regex(/^[1-9]\d{5}$/, 'Enter a valid 6-digit pincode.'),
}).strict();
const reauthBody = z.object({ password: z.string().min(1).max(256) });
const bankBody = z.object({
  accountHolder: z.string().trim().min(1).max(100),
  accountNumber: accountNumberSchema,
  ifsc: ifscSchema,
  bankName: z.string().trim().min(1).max(100),
  branch: z.string().trim().max(100).default(''),
});

const decryptOrNull = (value) => (value ? decryptField(value) : null);

const DOCUMENT_TYPES = [
  { type: 'tradeLicense', label: 'Trade license', keyField: 'tradeLicenseKey' },
  { type: 'gstCertificate', label: 'GST certificate', keyField: 'gstCertificateKey' },
  { type: 'idProof', label: 'Owner ID proof', keyField: 'idProofKey' },
];

// TODO: move with sellerApplications.routes.js once a dedicated "sellers" module exists.
export function createSellerSettingsRouter() {
  const router = Router();
  router.use(authenticate);

  // A seller reading their own profile: one lean findById by primary key, scoped by the
  // sellerId baked into their own access token (sellerScope) — no cross-seller query is
  // even expressible here, let alone needed, so this is already as cheap as it gets.
  router.get('/profile', async (req, res, next) => {
    try {
      const sellerId = sellerScope(req);
      const seller = await Seller.findById(sellerId).lean();
      if (!seller) throw new NotFoundError('Seller account not found.');

      const documents = DOCUMENT_TYPES.map(({ type, label, keyField }) => {
        const key = seller.documents?.[keyField];
        if (!key) return null;
        const [, folder, ownerId, file] = key.split('/');
        const url = `${env.PUBLIC_ORIGIN}/api/seller/v1/uploads/private/${folder}/${ownerId}/${file}?token=${signFileToken(key)}`;
        return {
          id: type,
          label,
          mimeType: file.endsWith('.pdf') ? 'application/pdf' : `image/${file.split('.').pop()}`,
          fileName: file,
          uploadedAt: seller.appliedAt,
          status: seller.documentDecisions?.[type]?.status ?? 'PENDING',
          rejectionReason: seller.documentDecisions?.[type]?.reason ?? null,
          // No document-versioning or expiry-tracking feature exists yet: every document
          // is honestly "version 1, no expiry, no history" rather than invented data.
          version: 1,
          expiryState: null,
          previousVersions: [],
          previewUrl: url,
          downloadUrl: url,
        };
      }).filter(Boolean);

      return sendData(res, {
        seller: {
          id: String(seller._id),
          storeName: seller.storeName,
          legalName: seller.legalName,
          gstin: decryptOrNull(seller.gstin),
          pan: decryptOrNull(seller.pan),
          tier: seller.tier ?? 'BRONZE',
          city: seller.location?.city,
          state: seller.location?.state,
          vacationMode: seller.vacationMode ?? false,
          logoKey: seller.logoKey ?? null,
          logoUrl: logoUrlOf(seller.logoKey),
        },
        documents,
        changeRequests: [], // no verified-identity-change workflow exists yet
      });
    } catch (error) {
      return next(error);
    }
  });

  // Writes are owner-only: SELLER_STAFF may read the profile but not change identity or payout details.
  const ownerOnly = authorize(ROLES.SELLER);
  const run = (handler, status) => async (req, res, next) => {
    try {
      return sendData(res, await handler(req), { status });
    } catch (error) {
      return next(error);
    }
  };
  const actorOf = (req) => ({ userId: req.auth.userId, role: req.auth.role, sellerId: req.auth.sellerId });

  router.patch('/profile', ownerOnly, validate({ body: profileBody }), run((req) => updateProfile(sellerScope(req), req.body, actorOf(req))));
  router.put('/gstin', ownerOnly, validate({ body: gstinBody }), run((req) => setGstin(sellerScope(req), req.body.gstin, actorOf(req))));
  router.get('/address', run((req) => getPickupAddress(sellerScope(req))));
  router.put('/address', ownerOnly, validate({ body: addressBody }), run((req) => setPickupAddress(sellerScope(req), req.body, actorOf(req))));
  router.post('/vacation', ownerOnly, validate({ body: vacationBody }), run((req) => setVacationMode(sellerScope(req), req.body.on, actorOf(req))));

  router.post(
    '/security/reauth',
    createRateLimiter({ name: 'seller-reauth', windowMs: 60_000, limit: 5 }),
    validate({ body: reauthBody }),
    run((req) => issueStepUpToken(req.auth.userId, req.body.password)),
  );

  // Payout account: one per seller, so PUT/DELETE on a singleton; changes need a fresh password check.
  router.get('/bank', run((req) => getBank(sellerScope(req))));
  router.put('/bank/account', ownerOnly, requireStepUp, validate({ body: bankBody }), run((req) => setBank(sellerScope(req), req.body, actorOf(req))));
  router.delete('/bank/account', ownerOnly, requireStepUp, run((req) => clearBank(sellerScope(req), actorOf(req))));

  return router;
}
