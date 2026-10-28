import { http as mswHttp } from 'msw';
import { db, find, update } from '@mocks/db/store';
import { mockNowIso } from '@mocks/engine/settings';
import { scheduleSave } from '@mocks/persistence';
import { badRequest, ok, unauthorized } from '@mocks/engine/respond';
import { publicUser, resolveCaller } from '@seller/mocks/engine/sellerAuth';
import { SELLER_BASE } from './auth';

function onboardingFor(sellerId) {
  return find('sellerOnboarding', (o) => o.sellerId === sellerId);
}

export const sellerOnboardingHandlers = [
  /* Current onboarding application for the signed-in seller. */
  mswHttp.get(`${SELLER_BASE}/onboarding`, ({ request }) => {
    const { user, error } = resolveCaller(request);
    if (error) return unauthorized();
    const record = onboardingFor(user.sellerId);
    if (!record) return ok({ status: 'APPROVED', step: null, complete: true });
    return ok(record);
  }),

  /* Save progress on one or more steps. `step` is the furthest step reached. */
  mswHttp.patch(`${SELLER_BASE}/onboarding`, async ({ request }) => {
    const { user, error } = resolveCaller(request);
    if (error) return unauthorized();
    const record = onboardingFor(user.sellerId);
    if (!record) return badRequest('Your account is already active.', 'ALREADY_ACTIVE');
    if (record.status === 'UNDER_REVIEW') return badRequest('Your application is under review and cannot be edited.', 'UNDER_REVIEW');

    const body = await request.json();
    const patch = { updatedAt: mockNowIso() };
    for (const key of ['business', 'tax', 'bank', 'pickup']) {
      if (body?.[key] !== undefined) patch[key] = { ...(record[key] ?? {}), ...body[key] };
    }
    if (typeof body?.step === 'number') patch.step = Math.max(record.step ?? 0, body.step);
    if (body?.agreementAccepted) patch.agreementAcceptedAt = mockNowIso();
    update('sellerOnboarding', record.id, patch);
    scheduleSave();
    return ok(find('sellerOnboarding', (o) => o.id === record.id));
  }),

  /* Submit for review — surfaces the application to the admin applications screen. */
  mswHttp.post(`${SELLER_BASE}/onboarding/submit`, async ({ request }) => {
    const { user, error } = resolveCaller(request);
    if (error) return unauthorized();
    const record = onboardingFor(user.sellerId);
    if (!record) return badRequest('Your account is already active.', 'ALREADY_ACTIVE');

    const missing = [];
    if (!record.business?.storeName) missing.push('business');
    if (!record.tax?.gstin || !record.tax?.pan) missing.push('tax');
    if (!record.bank?.accountNumber) missing.push('bank');
    if (!record.pickup?.line1) missing.push('pickup');
    if (!record.agreementAcceptedAt) missing.push('agreement');
    if (missing.length) {
      return badRequest(`Finish these steps before submitting: ${missing.join(', ')}.`, 'INCOMPLETE', {
        details: { missing },
      });
    }

    update('sellerOnboarding', record.id, { status: 'UNDER_REVIEW', step: 6, submittedAt: mockNowIso(), updatedAt: mockNowIso() });
    // Mirror key fields onto the seller record so admin review has them.
    update('sellers', user.sellerId, {
      gstin: record.tax.gstin,
      pan: record.tax.pan,
      legalName: record.business.legalName,
      appliedAt: mockNowIso(),
    });
    scheduleSave();
    return ok({ status: 'UNDER_REVIEW', user: publicUser(db.sellerUsers.find((u) => u.id === user.id)) });
  }),
];
