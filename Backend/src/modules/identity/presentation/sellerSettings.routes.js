import { Router } from 'express';
import { env } from '../../../config/env.js';
import { NotFoundError } from '../../../shared/errors/AppError.js';
import { sendData } from '../../../shared/http/respond.js';
import { authenticate } from '../../../shared/middleware/authenticate.js';
import { sellerScope } from '../../../shared/policies/ownership.js';
import { decryptField } from '../../../shared/utils/crypto.js';
import { signFileToken } from '../../../shared/utils/signedUrl.js';
import { Seller } from '../infrastructure/persistence/seller.model.js';

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
          // No holiday-mode or store-logo-upload feature exists yet.
          vacationMode: false,
          logoMediaId: null,
          logoUrl: null,
        },
        documents,
        changeRequests: [], // no verified-identity-change workflow exists yet
      });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
