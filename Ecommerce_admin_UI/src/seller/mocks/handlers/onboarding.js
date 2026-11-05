import { http as mswHttp } from 'msw';
import { find, findById, id, insert, update } from '@mocks/db/store';
import { writeAudit } from '@mocks/engine/audit';
import { mockNowIso } from '@mocks/engine/settings';
import { scheduleSave } from '@mocks/persistence';
import { badRequest, notFound, ok, unauthorized } from '@mocks/engine/respond';
import { publicUser, resolveCaller } from '@seller/mocks/engine/sellerAuth';
import {
  AGREEMENT, REQUIRED_DOCUMENTS, acceptAgreement, applicationFor,
  applicationProjection, ensureSections, markSection, upsertDocument,
} from '@mocks/engine/sellerOnboarding';
import { SELLER_BASE } from './auth';

function context(request) {
  const { user, error } = resolveCaller(request);
  if (error) return { response: unauthorized() };
  const application = applicationFor(user.sellerId);
  return application ? { user, application } : { response: badRequest('Your account is already active.', 'ALREADY_ACTIVE') };
}

function saveDocuments(application, documents = {}) {
  return Object.entries(documents).map(([type, media]) => upsertDocument(application, type, Array.isArray(media) ? media[0] : media)).filter(Boolean);
}

function upsertBank(application) {
  if (!application.bank?.accountNumber) return;
  const current = find('bankAccounts', (row) => row.sellerId === application.sellerId);
  const patch = {
    accountHolder: application.bank.accountName,
    accountNumber: application.bank.accountNumber,
    ifsc: application.bank.ifsc,
    bankName: application.bank.bankName ?? 'Verification pending',
    pennyDropStatus: 'VERIFIED', nameMatchPct: 100, verified: true,
  };
  if (current) update('bankAccounts', current.id, patch);
  else insert('bankAccounts', { id: id('BNK', 6), sellerId: application.sellerId, ...patch, version: 1 });
}

function upsertPickup(application) {
  if (!application.pickup?.line1) return;
  const current = find('pickupAddresses', (row) => row.sellerId === application.sellerId && row.isPrimary);
  const patch = {
    label: 'Primary warehouse', ...application.pickup,
    contactName: application.pickup.contactName ?? application.signatory?.name,
    contactPhone: application.pickup.contactPhone ?? application.signatory?.phone,
    isPrimary: true, geoVerified: true, serviceableCouriers: [],
  };
  if (current) update('pickupAddresses', current.id, patch);
  else insert('pickupAddresses', { id: id('PCK', 6), sellerId: application.sellerId, ...patch, version: 1 });
}

function missingRequirements(application) {
  const documents = applicationProjection(application).documents;
  const missing = [];
  if (!application.business?.storeName || !application.business?.legalName || !application.business?.businessType || !application.business?.registeredAddress) missing.push('business');
  if (!application.tax?.gstin || !application.tax?.pan) missing.push('tax');
  if (!application.signatory?.name || !application.signatory?.email || !application.signatory?.phone || !application.signatory?.contactVerified) missing.push('signatory');
  if (!application.bank?.accountNumber || !application.bank?.ifsc) missing.push('bank');
  if (!application.pickup?.line1 || !application.pickup?.pincode || application.pickup?.serviceable !== true) missing.push('pickup');
  if (!application.agreementAcceptedAt) missing.push('agreement');
  for (const type of REQUIRED_DOCUMENTS) if (!documents.some((document) => document.type === type)) missing.push(type.toLowerCase());
  return [...new Set(missing)];
}

export const sellerOnboardingHandlers = [
  mswHttp.get(`${SELLER_BASE}/onboarding`, ({ request }) => {
    const c = context(request); if (c.response) return c.response;
    return ok(applicationProjection(c.application));
  }),
  mswHttp.get(`${SELLER_BASE}/onboarding/status`, ({ request }) => {
    const c = context(request); if (c.response) return c.response;
    return ok(applicationProjection(c.application));
  }),
  mswHttp.get(`${SELLER_BASE}/onboarding/agreement`, ({ request }) => {
    const c = context(request); if (c.response) return c.response;
    return ok({
      ...AGREEMENT,
      sections: [
        { id: 'scope', title: '1. Marketplace appointment', text: 'You appoint Arise to provide marketplace, payment and fulfilment services for your approved catalogue.' },
        { id: 'compliance', title: '2. Compliance', text: 'You must keep tax, identity, category and product registrations accurate and current.' },
        { id: 'fees', title: '3. Fees and settlements', text: 'Commission, shipping and service fees follow the accepted commercial schedule. Settlements may be held for disputes or compliance review.' },
        { id: 'fulfilment', title: '4. Orders and fulfilment', text: 'Orders must be dispatched within the promised SLA using approved packaging and shipping documents.' },
        { id: 'termination', title: '5. Suspension and termination', text: 'Material policy breaches may lead to listing restrictions, payout holds, suspension or termination after applicable review.' },
      ],
    });
  }),
  mswHttp.get(`${SELLER_BASE}/onboarding/pincode/:pincode`, ({ request, params }) => {
    const c = context(request); if (c.response) return c.response;
    const pincode = String(params.pincode);
    if (!/^\d{6}$/.test(pincode)) return badRequest('Enter a valid six-digit PIN code.', 'PINCODE_INVALID');
    const serviceable = !pincode.endsWith('0');
    return ok({ pincode, serviceable, pickupAvailable: serviceable, message: serviceable ? 'Pickup is available at this PIN code.' : 'Pickup is not available at this PIN code yet.' });
  }),
  mswHttp.patch(`${SELLER_BASE}/onboarding`, async ({ request }) => {
    const c = context(request); if (c.response) return c.response;
    if (['UNDER_REVIEW', 'APPROVED'].includes(c.application.status)) return badRequest('Your application is read-only while it is under review.', 'UNDER_REVIEW');
    const body = await request.json();
    const patch = { updatedAt: mockNowIso() };
    for (const key of ['business', 'tax', 'signatory', 'bank', 'pickup']) {
      if (body?.[key] !== undefined) patch[key] = { ...(c.application[key] ?? {}), ...body[key] };
    }
    if (typeof body?.step === 'number') patch.step = Math.max(c.application.step ?? 0, body.step);
    update('sellerOnboarding', c.application.id, patch);
    saveDocuments(c.application, body.documents);
    if (body.sectionKey) markSection(c.application, body.sectionKey, 'DRAFT', { adminReason: null, correctiveAction: null });
    scheduleSave();
    return ok(applicationProjection(c.application));
  }),
  mswHttp.post(`${SELLER_BASE}/onboarding/agreement/accept`, async ({ request }) => {
    const c = context(request); if (c.response) return c.response;
    const body = await request.json().catch(() => ({}));
    if (body.version !== AGREEMENT.version) return badRequest('The agreement changed. Review the current version before accepting.', 'AGREEMENT_VERSION_CHANGED');
    const acceptance = acceptAgreement(c.application, c.user);
    update('sellerOnboarding', c.application.id, { agreementAcceptedAt: acceptance.acceptedAt, agreementVersion: acceptance.agreementVersion, updatedAt: mockNowIso() });
    markSection(c.application, 'agreement', 'DRAFT');
    scheduleSave();
    return ok(acceptance);
  }),
  mswHttp.post(`${SELLER_BASE}/onboarding/sections/:sectionKey/resubmit`, async ({ request, params }) => {
    const c = context(request); if (c.response) return c.response;
    const section = ensureSections(c.application).find((row) => row.key === params.sectionKey);
    if (!section) return notFound('That onboarding section does not exist.');
    if (!['CLARIFICATION_REQUIRED', 'REJECTED'].includes(section.state)) return badRequest('Only a section needing correction can be resubmitted.', 'SECTION_NOT_EDITABLE');
    const body = await request.json().catch(() => ({}));
    saveDocuments(c.application, body.documents);
    markSection(c.application, section.key, 'SUBMITTED', { submittedAt: mockNowIso(), adminReason: null, correctiveAction: null });
    const stillBlocked = ensureSections(c.application).some((row) => row.id !== section.id && ['CLARIFICATION_REQUIRED', 'REJECTED'].includes(row.state));
    update('sellerOnboarding', c.application.id, { status: stillBlocked ? 'CLARIFICATION_REQUIRED' : 'UNDER_REVIEW', updatedAt: mockNowIso() });
    if (!stillBlocked) update('sellers', c.application.sellerId, { status: 'UNDER_REVIEW' });
    writeAudit({ actor: c.user, action: 'onboarding.section.resubmit', entityType: 'seller', entityId: c.application.sellerId, entityLabel: section.label });
    scheduleSave();
    return ok(applicationProjection(c.application));
  }),
  mswHttp.post(`${SELLER_BASE}/onboarding/submit`, ({ request }) => {
    const c = context(request); if (c.response) return c.response;
    const missing = missingRequirements(c.application);
    if (missing.length) return badRequest(`Finish these items before submitting: ${missing.join(', ')}.`, 'INCOMPLETE', { details: { missing } });
    const now = mockNowIso();
    update('sellerOnboarding', c.application.id, { status: 'UNDER_REVIEW', step: 7, submittedAt: now, updatedAt: now });
    for (const section of ensureSections(c.application)) markSection(c.application, section.key, 'UNDER_REVIEW', { submittedAt: now, adminReason: null, correctiveAction: null });
    upsertBank(c.application); upsertPickup(c.application);
    update('sellers', c.user.sellerId, {
      status: 'UNDER_REVIEW', storeName: c.application.business.storeName,
      legalName: c.application.business.legalName, businessType: c.application.business.businessType,
      registeredAddress: c.application.business.registeredAddress,
      contactEmail: c.application.signatory.email, contactPhone: c.application.signatory.phone,
      gstin: c.application.tax.gstin,
      pan: c.application.tax.pan, city: c.application.pickup.city,
      state: c.application.pickup.state, pincode: c.application.pickup.pincode,
      appliedAt: now,
      gstinVerification: { status: 'ACTIVE', legalName: c.application.business.legalName },
      panVerification: { status: 'VALID', legalName: c.application.business.legalName },
    });
    writeAudit({ actor: c.user, action: 'onboarding.application.submit', entityType: 'seller', entityId: c.user.sellerId, entityLabel: c.application.business.storeName });
    scheduleSave();
    return ok({ status: 'UNDER_REVIEW', user: publicUser(findById('sellerUsers', c.user.id)) });
  }),
];
