import { HttpResponse, http as mswHttp } from 'msw';
import { db, findById, id, insert, remove, update } from '@mocks/db/store';
import { createJob, jobProgressPct, readJob } from '@mocks/engine/jobs';
import { mockNow, mockNowIso } from '@mocks/engine/settings';
import { scheduleSave } from '@mocks/persistence';
import {
  badRequest,
  created,
  forbidden,
  notFound,
  ok,
  unauthorized,
  validationFailed,
} from '@mocks/engine/respond';
import { resolveCaller } from '@seller/mocks/engine/sellerAuth';
import { SELLER_BASE } from './auth';

const ALLOWED_MEDIA_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'text/csv',
]);
const MAX_MEDIA_BYTES = 20 * 1024 * 1024;

function context(request, permission) {
  const result = resolveCaller(request);
  if (result.error) return { response: unauthorized() };
  const permissions = new Set(result.user.permissions ?? []);
  if (permission && !permissions.has('*') && !permissions.has(permission)) {
    return { response: forbidden('Your seller role does not permit this action.') };
  }
  return result;
}

function ownMedia(user, mediaId) {
  const media = findById('mediaResources', mediaId);
  return media?.sellerId === user.sellerId ? media : null;
}

function settleMedia(media) {
  if (media?.status === 'PROCESSING' && mockNow() >= media.readyAtMs) {
    update('mediaResources', media.id, {
      status: media.simulateProcessingFailure ? 'FAILED' : 'READY',
      processingError: media.simulateProcessingFailure ? 'The file could not be processed.' : null,
      processedAt: mockNowIso(),
    });
  }
  return media;
}

function ownJob(user, jobId) {
  const job = findById('jobs', jobId);
  return job?.sellerId === user.sellerId ? job : null;
}

export const sellerFoundationHandlers = [
  mswHttp.post(`${SELLER_BASE}/media/uploads`, async ({ request }) => {
    const c = context(request, 'media.upload.create');
    if (c.response) return c.response;
    const body = await request.json();
    const fieldErrors = {};
    if (!body?.fileName) fieldErrors.fileName = 'A file name is required.';
    if (!ALLOWED_MEDIA_TYPES.has(body?.mimeType)) fieldErrors.mimeType = 'This file type is not supported.';
    if (!Number(body?.sizeBytes) || Number(body.sizeBytes) > MAX_MEDIA_BYTES) {
      fieldErrors.sizeBytes = 'Files must be between 1 byte and 20 MB.';
    }
    if (Object.keys(fieldErrors).length) return validationFailed(fieldErrors);

    const mediaId = id('MED', 8);
    const upload = insert('mediaUploads', {
      id: id('UPL', 8),
      mediaId,
      sellerId: c.user.sellerId,
      status: 'PRESIGNED',
      createdAt: mockNowIso(),
      expiresAt: new Date(mockNow() + 15 * 60_000).toISOString(),
    });
    insert('mediaResources', {
      id: mediaId,
      sellerId: c.user.sellerId,
      kind: body.kind ?? 'ATTACHMENT',
      fileName: body.fileName,
      mimeType: body.mimeType,
      sizeBytes: Number(body.sizeBytes),
      width: body.width ?? null,
      height: body.height ?? null,
      status: 'AWAITING_UPLOAD',
      previewUrl: `${SELLER_BASE}/media/${mediaId}/preview`,
      downloadUrl: `${SELLER_BASE}/media/${mediaId}/download`,
      crop: null,
      createdAt: mockNowIso(),
      createdBy: c.user.id,
      version: 1,
    });
    scheduleSave();
    return created({
      uploadId: upload.id,
      mediaId,
      uploadUrl: `/media/uploads/${upload.id}/content`,
      expiresAt: upload.expiresAt,
    });
  }),

  mswHttp.put(`${SELLER_BASE}/media/uploads/:id/content`, async ({ request, params }) => {
    const c = context(request, 'media.upload.create');
    if (c.response) return c.response;
    const upload = findById('mediaUploads', params.id);
    if (!upload || upload.sellerId !== c.user.sellerId) return notFound('Upload session not found.');
    if (new Date(upload.expiresAt).getTime() < mockNow()) return badRequest('Upload session expired.', 'UPLOAD_EXPIRED');
    update('mediaUploads', upload.id, { status: 'UPLOADED', uploadedAt: mockNowIso() });
    update('mediaResources', upload.mediaId, { status: 'UPLOADED' });
    scheduleSave();
    return ok({ uploaded: true });
  }),

  mswHttp.post(`${SELLER_BASE}/media/uploads/:id/complete`, async ({ request, params }) => {
    const c = context(request, 'media.upload.create');
    if (c.response) return c.response;
    const upload = findById('mediaUploads', params.id);
    if (!upload || upload.sellerId !== c.user.sellerId) return notFound('Upload session not found.');
    if (upload.status === 'COMPLETED') return ok(settleMedia(findById('mediaResources', upload.mediaId)));
    if (upload.status !== 'UPLOADED') return badRequest('Upload the file before completing it.', 'UPLOAD_INCOMPLETE');
    const body = await request.json().catch(() => ({}));
    update('mediaUploads', upload.id, { status: 'COMPLETED', completedAt: mockNowIso() });
    const media = update('mediaResources', upload.mediaId, {
      status: 'PROCESSING',
      width: body?.width ?? null,
      height: body?.height ?? null,
      readyAtMs: mockNow() + 700,
      simulateProcessingFailure: Boolean(body?.simulateProcessingFailure),
    });
    scheduleSave();
    return ok(media);
  }),

  mswHttp.delete(`${SELLER_BASE}/media/uploads/:id`, async ({ request, params }) => {
    const c = context(request, 'media.upload.create');
    if (c.response) return c.response;
    const upload = findById('mediaUploads', params.id);
    if (!upload || upload.sellerId !== c.user.sellerId) return notFound('Upload session not found.');
    update('mediaUploads', upload.id, { status: 'ABORTED', abortedAt: mockNowIso() });
    update('mediaResources', upload.mediaId, { status: 'CANCELLED' });
    scheduleSave();
    return ok({ aborted: true });
  }),

  // Image tags cannot attach the bearer token. The opaque media ID is only a
  // mock preview capability; production uses a short-lived signed CDN URL.
  mswHttp.get(`${SELLER_BASE}/media/:id/preview`, async ({ params }) => {
    const media = findById('mediaResources', params.id);
    if (!media) return new HttpResponse(null, { status: 404 });
    const safeName = String(media.fileName).replace(/[<>&]/g, '');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800"><rect width="100%" height="100%" fill="#eef2f6"/><text x="50%" y="48%" text-anchor="middle" fill="#52606d" font-family="sans-serif" font-size="28">Uploaded media</text><text x="50%" y="54%" text-anchor="middle" fill="#7b8794" font-family="sans-serif" font-size="18">${safeName}</text></svg>`;
    return new HttpResponse(svg, { headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'private, max-age=60' } });
  }),

  mswHttp.get(`${SELLER_BASE}/media/:id/download`, async ({ params }) => {
    const media = findById('mediaResources', params.id);
    if (!media) return new HttpResponse(null, { status: 404 });
    return new HttpResponse(`Mock artifact for ${media.fileName}`, {
      headers: { 'Content-Type': media.mimeType, 'Content-Disposition': `attachment; filename="${String(media.fileName).replace(/["\r\n]/g, '')}"` },
    });
  }),

  mswHttp.get(`${SELLER_BASE}/media/:id`, async ({ request, params }) => {
    const c = context(request, 'media.media.view');
    if (c.response) return c.response;
    const media = ownMedia(c.user, params.id);
    if (!media) return notFound('Media not found.');
    return ok(settleMedia(media));
  }),

  mswHttp.patch(`${SELLER_BASE}/media/:id`, async ({ request, params }) => {
    const c = context(request, 'media.upload.create');
    if (c.response) return c.response;
    const media = ownMedia(c.user, params.id);
    if (!media) return notFound('Media not found.');
    const body = await request.json();
    const crop = body?.crop;
    if (crop && !['original', 'square', '4:3', '16:9'].includes(crop.aspect)) {
      return badRequest('Unsupported crop aspect.', 'BAD_CROP');
    }
    update('mediaResources', media.id, { crop: crop ?? media.crop });
    scheduleSave();
    return ok(findById('mediaResources', media.id));
  }),

  mswHttp.delete(`${SELLER_BASE}/media/:id`, async ({ request, params }) => {
    const c = context(request, 'media.upload.delete');
    if (c.response) return c.response;
    const media = ownMedia(c.user, params.id);
    if (!media) return notFound('Media not found.');
    remove('mediaResources', media.id);
    scheduleSave();
    return ok({ deleted: true });
  }),

  mswHttp.post(`${SELLER_BASE}/exports`, async ({ request }) => {
    const c = context(request, 'exports.job.create');
    if (c.response) return c.response;
    const idempotencyKey = request.headers.get('Idempotency-Key');
    if (!idempotencyKey) return badRequest('An Idempotency-Key header is required.', 'IDEMPOTENCY_KEY_REQUIRED');
    const replay = db.idempotencyRecords.find((row) => row.sellerId === c.user.sellerId && row.key === idempotencyKey);
    if (replay) return ok(findById('jobs', replay.resourceId));
    const body = await request.json();
    if (!body?.resource) return validationFailed({ resource: 'Choose data to export.' });
    const job = createJob({
      type: 'SELLER_EXPORT',
      label: body.label ?? `${body.resource} export`,
      actor: c.user,
      totalRows: Math.max(1, Number(body.estimatedRows) || 100),
      durationMs: 1200,
      resultUrl: `/mock-downloads/${body.resource}-${Date.now()}.${String(body.format ?? 'csv').toLowerCase()}`,
      metadata: {
        resource: body.resource,
        format: body.format ?? 'CSV',
        selection: body.selection ?? { mode: 'FILTERED', filters: body.filters ?? {} },
      },
    });
    job.sellerId = c.user.sellerId;
    insert('idempotencyRecords', { id: id('IDEM', 8), sellerId: c.user.sellerId, key: idempotencyKey, operation: 'seller.export.create', resourceId: job.id, createdAt: mockNowIso() });
    scheduleSave();
    return created(job);
  }),

  mswHttp.get(`${SELLER_BASE}/jobs`, async ({ request }) => {
    const c = context(request, 'exports.job.view');
    if (c.response) return c.response;
    const jobs = db.jobs
      .filter((job) => job.sellerId === c.user.sellerId)
      .map((job) => ({ ...readJob(job.id), progressPct: jobProgressPct(readJob(job.id)) }))
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    return ok(jobs);
  }),

  mswHttp.get(`${SELLER_BASE}/jobs/:id`, async ({ request, params }) => {
    const c = context(request, 'exports.job.view');
    if (c.response) return c.response;
    const job = ownJob(c.user, params.id);
    if (!job) return notFound('Export job not found.');
    const fresh = readJob(job.id);
    return ok({ ...fresh, progressPct: jobProgressPct(fresh) });
  }),

  mswHttp.get(`${SELLER_BASE}/saved-views`, async ({ request }) => {
    const c = context(request);
    if (c.response) return c.response;
    const tableId = new URL(request.url).searchParams.get('tableId');
    return ok(db.savedViews.filter((view) => view.sellerId === c.user.sellerId && (!tableId || view.tableId === tableId)));
  }),

  mswHttp.post(`${SELLER_BASE}/saved-views`, async ({ request }) => {
    const c = context(request);
    if (c.response) return c.response;
    const body = await request.json();
    if (!body?.tableId || !body?.name) return validationFailed({ name: 'Name and table are required.' });
    const view = insert('savedViews', {
      id: id('SVW', 6),
      sellerId: c.user.sellerId,
      ownerId: c.user.id,
      tableId: body.tableId,
      name: body.name.trim(),
      state: body.state ?? {},
      isDefault: Boolean(body.isDefault),
      createdAt: mockNowIso(),
      updatedAt: mockNowIso(),
    });
    scheduleSave();
    return created(view);
  }),

  mswHttp.delete(`${SELLER_BASE}/saved-views/:id`, async ({ request, params }) => {
    const c = context(request);
    if (c.response) return c.response;
    const view = findById('savedViews', params.id);
    if (!view || view.sellerId !== c.user.sellerId) return notFound('Saved view not found.');
    remove('savedViews', view.id);
    scheduleSave();
    return ok({ deleted: true });
  }),
];
