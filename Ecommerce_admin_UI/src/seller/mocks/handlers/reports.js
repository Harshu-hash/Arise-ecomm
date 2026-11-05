import { http as mswHttp } from 'msw';
import { db, findById, id, insert, remove, update } from '@mocks/db/store';
import { mockNow, mockNowIso } from '@mocks/engine/settings';
import { scheduleSave } from '@mocks/persistence';
import { badRequest, created, notFound, ok, unauthorized } from '@mocks/engine/respond';
import { resolveCaller } from '@seller/mocks/engine/sellerAuth';
import { SELLER_BASE } from './auth';

const REPORT_KEYS = new Set(['orders', 'transactions', 'inventory', 'ads']);
const FREQUENCIES = new Set(['DAILY', 'WEEKLY', 'MONTHLY']);
const FORMATS = new Set(['CSV', 'XLSX']);

function caller(request) {
  const result = resolveCaller(request);
  return result.error ? { response: unauthorized() } : result;
}

function nextRunAt(frequency) {
  const days = frequency === 'DAILY' ? 1 : frequency === 'WEEKLY' ? 7 : 30;
  return new Date(mockNow() + days * 24 * 60 * 60 * 1000).toISOString();
}

function own(user, scheduleId) {
  const schedule = findById('sellerReportSchedules', scheduleId);
  return schedule?.sellerId === user.sellerId ? schedule : null;
}

function ownTemplate(user, templateId) {
  const template = findById('sellerReportTemplates', templateId);
  return template?.sellerId === user.sellerId ? template : null;
}

export const sellerReportHandlers = [
  mswHttp.get(`${SELLER_BASE}/reports/templates`, async ({ request }) => {
    const c = caller(request);
    if (c.response) return c.response;
    return ok(db.sellerReportTemplates.filter((row) => row.sellerId === c.user.sellerId));
  }),

  mswHttp.post(`${SELLER_BASE}/reports/templates`, async ({ request }) => {
    const c = caller(request);
    if (c.response) return c.response;
    const body = await request.json();
    if (!REPORT_KEYS.has(body?.reportKey) || !body?.name?.trim()) return badRequest('Add a template name and supported report.', 'REPORT_TEMPLATE_INVALID');
    const row = insert('sellerReportTemplates', { id: id('SRT', 6), sellerId: c.user.sellerId, createdBy: c.user.id, name: body.name.trim(), reportKey: body.reportKey, filters: body.filters ?? {}, format: FORMATS.has(body.format) ? body.format : 'CSV', retentionDays: 30, createdAt: mockNowIso() });
    scheduleSave();
    return created(row);
  }),

  mswHttp.delete(`${SELLER_BASE}/reports/templates/:id`, async ({ request, params }) => {
    const c = caller(request);
    if (c.response) return c.response;
    const template = ownTemplate(c.user, params.id);
    if (!template) return notFound('Report template not found.');
    remove('sellerReportTemplates', template.id); scheduleSave();
    return ok({ deleted: true });
  }),

  mswHttp.get(`${SELLER_BASE}/reports/schedules`, async ({ request }) => {
    const c = caller(request);
    if (c.response) return c.response;
    return ok(db.sellerReportSchedules.filter((row) => row.sellerId === c.user.sellerId));
  }),

  mswHttp.post(`${SELLER_BASE}/reports/schedules`, async ({ request }) => {
    const c = caller(request);
    if (c.response) return c.response;
    const body = await request.json();
    if (!REPORT_KEYS.has(body?.reportKey)) return badRequest('Choose a supported report.', 'REPORT_INVALID');
    if (!FREQUENCIES.has(body?.frequency)) return badRequest('Choose a valid frequency.', 'REPORT_INVALID');
    if (!FORMATS.has(body?.format)) return badRequest('Choose CSV or XLSX.', 'REPORT_INVALID');
    const recipients = [...new Set((body?.recipients ?? []).map((email) => String(email).trim().toLowerCase()).filter((email) => email.includes('@')))];
    if (!recipients.length) return badRequest('Add at least one recipient email.', 'REPORT_INVALID');
    const row = insert('sellerReportSchedules', {
      id: id('SRS', 6),
      sellerId: c.user.sellerId,
      createdBy: c.user.id,
      reportKey: body.reportKey,
      frequency: body.frequency,
      format: body.format,
      recipients,
      enabled: true,
      lastRunAt: null,
      nextRunAt: nextRunAt(body.frequency),
      createdAt: mockNowIso(),
    });
    scheduleSave();
    return created(row);
  }),

  mswHttp.patch(`${SELLER_BASE}/reports/schedules/:id`, async ({ request, params }) => {
    const c = caller(request);
    if (c.response) return c.response;
    const schedule = own(c.user, params.id);
    if (!schedule) return notFound('Schedule not found.');
    const body = await request.json();
    const patch = {};
    if (typeof body?.enabled === 'boolean') patch.enabled = body.enabled;
    if (FREQUENCIES.has(body?.frequency)) {
      patch.frequency = body.frequency;
      patch.nextRunAt = nextRunAt(body.frequency);
    }
    update('sellerReportSchedules', schedule.id, patch);
    scheduleSave();
    return ok(findById('sellerReportSchedules', schedule.id));
  }),

  mswHttp.delete(`${SELLER_BASE}/reports/schedules/:id`, async ({ request, params }) => {
    const c = caller(request);
    if (c.response) return c.response;
    const schedule = own(c.user, params.id);
    if (!schedule) return notFound('Schedule not found.');
    remove('sellerReportSchedules', schedule.id);
    scheduleSave();
    return ok({ deleted: true });
  }),
];

