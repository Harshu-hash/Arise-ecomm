import { http as mswHttp } from 'msw';
import { findById } from '@mocks/db/store';
import { scheduleSave } from '@mocks/persistence';
import { badRequest, notFound, ok, unauthorized } from '@mocks/engine/respond';
import { publicUser, resolveCaller, sellerFor } from '@seller/mocks/engine/sellerAuth';
import {
  addPickupAddress,
  bankAccountFor,
  inviteUser,
  pickupAddressesFor,
  profileFor,
  revokeUser,
  sellerTeam,
  setBankAccount,
  setVacationMode,
  updateNotificationPrefs,
  updateProfile,
} from '@seller/mocks/engine/sellerSettings';
import { SELLER_ROLE_TEMPLATES } from '@seller/rbac/permissions';
import { SELLER_BASE } from './auth';

function ctx(request) {
  const { user, error } = resolveCaller(request);
  if (error) return { response: unauthorized() };
  return { user, seller: sellerFor(user) ?? findById('sellers', user.sellerId) };
}

export const sellerSettingsHandlers = [
  /* ---------------------------------------------------------------- profile */
  mswHttp.get(`${SELLER_BASE}/settings/profile`, async ({ request }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    return ok(profileFor(c.user.sellerId));
  }),

  mswHttp.patch(`${SELLER_BASE}/settings/profile`, async ({ request }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    const body = await request.json();
    const seller = updateProfile(c.seller, body);
    scheduleSave();
    return ok(seller);
  }),

  mswHttp.post(`${SELLER_BASE}/settings/vacation`, async ({ request }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    const body = await request.json();
    const seller = setVacationMode(c.seller, body?.on);
    scheduleSave();
    return ok(seller);
  }),

  /* --------------------------------------------------------- bank & pickup */
  mswHttp.get(`${SELLER_BASE}/settings/bank`, async ({ request }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    return ok({ account: bankAccountFor(c.user.sellerId) ?? null, addresses: pickupAddressesFor(c.user.sellerId) });
  }),

  mswHttp.put(`${SELLER_BASE}/settings/bank/account`, async ({ request }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    const body = await request.json();
    const { error, account } = setBankAccount(c.seller, body);
    if (error) return badRequest(error, 'BANK_INVALID');
    scheduleSave();
    return ok(account);
  }),

  mswHttp.post(`${SELLER_BASE}/settings/bank/pickup-addresses`, async ({ request }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    const body = await request.json();
    const { error, address } = addPickupAddress(c.seller, body);
    if (error) return badRequest(error, 'ADDRESS_INVALID');
    scheduleSave();
    return ok(address);
  }),

  /* -------------------------------------------------------------- team */
  mswHttp.get(`${SELLER_BASE}/settings/users`, async ({ request }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    return ok({ team: sellerTeam(c.user.sellerId), roles: SELLER_ROLE_TEMPLATES.filter((r) => r.key !== 'owner') });
  }),

  mswHttp.post(`${SELLER_BASE}/settings/users/invite`, async ({ request }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    const body = await request.json();
    const { error, user } = inviteUser(c.seller, body);
    if (error) return badRequest(error, 'INVITE_INVALID');
    scheduleSave();
    return ok(user);
  }),

  mswHttp.post(`${SELLER_BASE}/settings/users/:id/revoke`, async ({ request, params }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    const target = findById('sellerUsers', params.id);
    if (!target || target.sellerId !== c.user.sellerId) return notFound('That user is not on your team.');
    const { error, user } = revokeUser(c.seller, target);
    if (error) return badRequest(error, 'CANNOT_REVOKE');
    scheduleSave();
    return ok(user);
  }),

  /* ------------------------------------------------------- notifications */
  mswHttp.patch(`${SELLER_BASE}/settings/notifications`, async ({ request }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    const body = await request.json();
    updateNotificationPrefs(c.user, body);
    scheduleSave();
    return ok(publicUser(findById('sellerUsers', c.user.id)));
  }),
];
