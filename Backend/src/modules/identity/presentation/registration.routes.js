import { Router } from 'express';
import { z } from 'zod';
import { NotFoundError, ValidationError } from '../../../shared/errors/AppError.js';
import { sendCommand, sendData } from '../../../shared/http/respond.js';
import { validate } from '../../../shared/http/validate.js';
import { uploadFields } from '../../../shared/middleware/upload.js';
import { emailSchema, objectIdSchema, phoneINSchema } from '../../../shared/validators/common.js';
import { checkExists, registerSeller, sendRegistrationOtp, verifyRegistrationOtp } from '../application/registration.service.js';
import { Seller } from '../infrastructure/persistence/seller.model.js';
import { User } from '../infrastructure/persistence/user.model.js';

const DOC_FIELDS = ['tradeLicense', 'gstCertificate', 'idProof'];

const targetSchema = z.object({ kind: z.enum(['email', 'phone']), value: z.string().trim().min(1) });
const verifyOtpSchema = z.object({ challengeId: objectIdSchema, code: z.string().min(4).max(10) });

const registerSchema = z.object({
  name: z.string().trim().min(1).max(50).regex(/^[A-Za-z ]+$/, 'Use letters and spaces only.'),
  shopName: z.string().trim().min(1),
  email: emailSchema,
  phone: phoneINSchema,
  password: z.string().min(8).regex(/^(?=.*[A-Za-z])(?=.*\d)/, 'Include a letter and a number.'),
  locality: z.string().trim().min(1),
  pincode: z.string().regex(/^\d{6}$/, 'Enter a 6-digit pincode.'),
  city: z.string().trim().min(1),
  state: z.string().trim().min(1),
  address: z.string().trim().min(1),
  gstin: z.string().regex(/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, 'Enter a valid 15-character GSTIN.'),
  pan: z.string().regex(/^[A-Z]{5}\d{4}[A-Z]$/, 'Enter a valid 10-character PAN.'),
  bankAccountHolder: z.string().trim().min(1),
  bankAccountNumber: z.string().regex(/^\d{9,18}$/, 'Enter a valid account number.'),
  bankIfsc: z.string().regex(/^[A-Z]{4}0[A-Z\d]{6}$/, 'Enter a valid 11-character IFSC code.'),
  emailVerificationToken: z.string().min(1),
  phoneVerificationToken: z.string().min(1),
});

// Seller-only: the 3-step "Apply to sell on Arise" flow, mounted under the same
// /api/seller/v1/auth prefix (and so the same auth-bucket rate limiter) as login.
export function createRegistrationRouter() {
  const router = Router();

  router.post('/register/check-exists', validate({ body: targetSchema }), async (req, res, next) => {
    try {
      return sendCommand(res, await checkExists(req.body));
    } catch (error) {
      return next(error);
    }
  });

  router.post('/register/send-otp', validate({ body: targetSchema }), async (req, res, next) => {
    try {
      return sendCommand(res, await sendRegistrationOtp(req.body));
    } catch (error) {
      return next(error);
    }
  });

  router.post('/register/verify-otp', validate({ body: verifyOtpSchema }), async (req, res, next) => {
    try {
      return sendCommand(res, await verifyRegistrationOtp(req.body));
    } catch (error) {
      return next(error);
    }
  });

  // Public, unauthenticated: the applicant has no session yet. Knowing the application id
  // (an unguessable Mongo ObjectId, handed back only to the applicant who created it) is
  // the whole access control here — the same model as an order-tracking page. Shares the
  // /auth rate-limit bucket, so it can't be used to enumerate ids at volume either.
  router.get('/application-status/:id', validate({ params: z.object({ id: objectIdSchema }) }), async (req, res, next) => {
    try {
      const seller = await Seller.findById(req.params.id, 'storeName status rejectionReason').lean();
      if (!seller) throw new NotFoundError('This application no longer exists.');
      const owner = await User.findOne({ sellerId: req.params.id, role: 'SELLER' }, 'email').lean();

      return sendData(res, {
        applicationId: String(seller._id),
        applicationStatus: seller.status,
        storeName: seller.storeName,
        email: owner?.email ?? null,
        rejectionReason: seller.rejectionReason,
      });
    } catch (error) {
      return next(error);
    }
  });

  router.post('/register', uploadFields(DOC_FIELDS), validate({ body: registerSchema }), async (req, res, next) => {
    try {
      const missing = DOC_FIELDS.filter((name) => !req.files?.[name]?.[0]);
      if (missing.length) {
        throw new ValidationError('Required documents are missing.', Object.fromEntries(missing.map((name) => [name, ['Required']])));
      }
      const result = await registerSeller({ fields: req.body, files: req.files });
      return sendCommand(res, result, { status: 201 });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
