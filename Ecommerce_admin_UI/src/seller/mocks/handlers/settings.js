import { http as mswHttp } from 'msw';
import { db, findById, id, insert, update } from '@mocks/db/store';
import { mockNowIso } from '@mocks/engine/settings';
import { scheduleSave } from '@mocks/persistence';
import { badRequest, conflict, created, notFound, ok, unauthorized, versionConflict } from '@mocks/engine/respond';
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
  updateWarehouse,
  updateNotificationPrefs,
  updateProfile,
  warehouseDependencies,
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

  mswHttp.post(`${SELLER_BASE}/settings/profile/change-requests`, async ({ request }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    const body = await request.json();
    if (!String(body?.proposedValue ?? '').trim() || !String(body?.reason ?? '').trim()) return badRequest('Provide the proposed legal name and the reason for the change.', 'CHANGE_REQUEST_INVALID');
    const row = insert('sellerChangeRequests', {
      id: id('SCR', 6), sellerId: c.seller.id, field: 'legalName',
      currentValue: c.seller.legalName, proposedValue: body.proposedValue.trim(),
      reason: body.reason.trim(), evidenceMediaIds: body.evidenceMediaIds ?? [],
      status: 'UNDER_REVIEW', createdAt: mockNowIso(), decidedAt: null,
      decisionReason: null, version: 1,
    });
    scheduleSave();
    return ok(row);
  }),

  mswHttp.post(`${SELLER_BASE}/settings/profile/documents/:documentId/renew`, async ({ request, params }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    const document = findById('kycDocuments', params.documentId);
    if (!document || document.sellerId !== c.seller.id) return notFound('That document does not belong to your account.');
    const body = await request.json();
    const mediaId = body?.mediaId;
    const media = findById('mediaResources', mediaId);
    if (!media || media.sellerId !== c.seller.id) return badRequest('Upload the replacement document first.', 'MEDIA_REQUIRED');
    const previousVersions = [...(document.previousVersions ?? []), { mediaId: document.mediaId, fileName: document.fileName, uploadedAt: document.uploadedAt, status: document.status, version: document.version }];
    update('kycDocuments', document.id, {
      mediaId, fileName: media.fileName, mimeType: media.mimeType,
      previewUrl: media.previewUrl, downloadUrl: media.downloadUrl,
      uploadedAt: mockNowIso(), status: 'PENDING', rejectionReason: null,
      expiresAt: body.expiresAt ?? null, previousVersions,
      version: (document.version ?? 1) + 1,
    });
    scheduleSave();
    return ok(findById('kycDocuments', document.id));
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

  /* ------------------------------------------------ seller warehouses */
  mswHttp.get(`${SELLER_BASE}/settings/warehouses`, async ({ request }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    return ok(pickupAddressesFor(c.user.sellerId).map((row) => ({
      ...row,
      status: row.status ?? 'ACTIVE',
      pickupCapable: row.pickupCapable !== false,
      dependencies: warehouseDependencies(c.user.sellerId, row.id),
    })));
  }),

  mswHttp.post(`${SELLER_BASE}/settings/warehouses`, async ({ request }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    const { error, address } = addPickupAddress(c.seller, await request.json());
    if (error) return badRequest(error, 'WAREHOUSE_INVALID');
    scheduleSave();
    return created(address);
  }),

  mswHttp.patch(`${SELLER_BASE}/settings/warehouses/:id`, async ({ request, params }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    const row = findById('pickupAddresses', params.id);
    if (!row || row.sellerId !== c.user.sellerId) return notFound('That warehouse is not on your account.');
    const body = await request.json();
    if (body.version != null && Number(body.version) !== row.version) return versionConflict(row);
    const updated = updateWarehouse(c.seller, row, body);
    scheduleSave();
    return ok(updated);
  }),

  mswHttp.post(`${SELLER_BASE}/settings/warehouses/:id/deactivate`, async ({ request, params }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    const row = findById('pickupAddresses', params.id);
    if (!row || row.sellerId !== c.user.sellerId) return notFound('That warehouse is not on your account.');
    const deps = warehouseDependencies(c.user.sellerId, row.id);
    if (deps.blocked) return conflict('Move active stock and complete open orders before deactivating this warehouse.', 'WAREHOUSE_HAS_DEPENDENCIES', { details: { stockRecords: deps.inventory.length, activeOrders: deps.activeOrders.length } });
    if (row.isPrimary) return conflict('Choose another primary warehouse before deactivating this one.', 'PRIMARY_WAREHOUSE');
    update('pickupAddresses', row.id, { status: 'INACTIVE', pickupCapable: false, deactivatedAt: mockNowIso() });
    scheduleSave();
    return ok(findById('pickupAddresses', row.id));
  }),

  /* -------------------------------------------------------------- team */
  mswHttp.get(`${SELLER_BASE}/settings/users`, async ({ request }) => {
    const c = ctx(request);
    if (c.response) return c.response;
    return ok({ team: sellerTeam(c.user.sellerId), roles: [...SELLER_ROLE_TEMPLATES.filter((r) => r.key !== 'owner'), ...db.sellerRoles.filter((r) => r.sellerId === c.user.sellerId).map((r) => ({ ...r, key: r.id }))] });
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
