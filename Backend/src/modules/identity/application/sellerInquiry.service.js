import { decryptField, encryptField } from '../../../shared/utils/crypto.js';
import { env } from '../../../config/env.js';
import { recordAudit } from '../../../infrastructure/audit/audit.js';
import { sendMail } from '../../../infrastructure/external/notification/mailer.js';
import { AppError, NotFoundError, ValidationError } from '../../../shared/errors/AppError.js';
import { SellerInquiry } from '../infrastructure/persistence/sellerInquiry.model.js';

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const SORT_FIELDS = { businessName: 'businessName', email: 'email', mobile: 'mobile', pickupPincode: 'pickupPincode', submittedAt: 'submittedAt' };

const serialize = (row) => ({
  id: String(row._id),
  businessName: row.businessName,
  email: row.email ?? null,
  gstin: decryptField(row.gstin),
  mobile: row.mobile,
  pickupPincode: row.pickupPincode,
  status: row.status,
  submittedAt: row.submittedAt.toISOString(),
  inviteSentAt: row.inviteSentAt?.toISOString() ?? null,
});

export async function createSellerInquiry(customerId, input) {
  const inquiry = await SellerInquiry.findOneAndUpdate(
    { customerId },
    { $setOnInsert: { ...input, customerId, gstin: encryptField(input.gstin) } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  return { id: String(inquiry._id), status: inquiry.status, submittedAt: inquiry.submittedAt.toISOString() };
}

export async function getSellerInquiry(customerId) {
  const inquiry = await SellerInquiry.findOne({ customerId }, 'status submittedAt').lean();
  return inquiry
    ? { id: String(inquiry._id), status: inquiry.status, submittedAt: inquiry.submittedAt.toISOString() }
    : null;
}

export async function sendSellerInquiryInvite(id, actor) {
  const inquiry = await SellerInquiry.findById(id);
  if (!inquiry) throw new NotFoundError('This seller inquiry no longer exists.');
  if (!inquiry.email) throw new ValidationError('This inquiry has no email address.');
  if (inquiry.inviteSentAt) return { inviteSentAt: inquiry.inviteSentAt.toISOString() };

  const registerUrl = `${env.PUBLIC_ORIGIN}/seller/register?email=${encodeURIComponent(inquiry.email)}`;
  const messageId = await sendMail({
    to: inquiry.email,
    subject: 'Complete your Arise seller application',
    text: `You are invited to sell on Arise. Complete your seller application here: ${registerUrl}\n\nThis registration includes email and phone verification, business details, and required documents.`,
  });
  if (!messageId) {
    throw new AppError({ code: 'SMTP_NOT_CONFIGURED', status: 503, message: 'SMTP is not configured, so the invite was not sent.' });
  }

  inquiry.inviteSentAt = new Date();
  inquiry.inviteSentBy = actor.userId;
  await inquiry.save();
  await recordAudit({
    action: 'seller.inquiry.invite',
    subjectType: 'seller_inquiry',
    subjectId: inquiry._id,
    after: { inviteSentAt: inquiry.inviteSentAt },
    actor,
  });
  return { inviteSentAt: inquiry.inviteSentAt.toISOString() };
}

export async function listSellerInquiries({ page, pageSize, q, sort }) {
  const match = q
    ? { $or: ['businessName', 'email', 'mobile', 'pickupPincode'].map((field) => ({ [field]: { $regex: escapeRegex(q), $options: 'i' } })) }
    : {};
  const requestedField = sort.replace(/^-/, '');
  const sortField = SORT_FIELDS[requestedField] ?? 'submittedAt';
  const descending = SORT_FIELDS[requestedField] ? sort.startsWith('-') : true;
  const [rows, total] = await Promise.all([
    SellerInquiry.find(match).sort({ [sortField]: descending ? -1 : 1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
    SellerInquiry.countDocuments(match),
  ]);
  return { rows: rows.map(serialize), total };
}
