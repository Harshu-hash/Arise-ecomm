/* eslint-disable max-lines */
import { http as mswHttp } from 'msw';
import { filter, findById, id, insert, update } from '@mocks/db/store';
import { listResult, parseListQuery } from '@mocks/engine/list';
import { recordEvent, refreshOrder } from '@mocks/engine/orderState';
import { mockNow, mockNowIso } from '@mocks/engine/settings';
import { scheduleSave } from '@mocks/persistence';
import {
  badRequest,
  conflict,
  created,
  notFound,
  ok,
  okList,
  unauthorized,
  validationFailed,
} from '@mocks/engine/respond';
import { resolveCaller } from '@seller/mocks/engine/sellerAuth';
import { sellerOrders, shipmentRow } from '@seller/mocks/engine/sellerOrders';
import { SELLER_BASE } from './auth';

function context(request) {
  const { user, error } = resolveCaller(request);
  return error ? { response: unauthorized() } : { user };
}

function ownShipment(user, shipmentId) {
  const shipment = findById('shipments', shipmentId);
  return shipment?.sellerId === user.sellerId ? shipment : null;
}

function logisticsRow(shipment) {
  const order = findById('orders', shipment.orderId);
  return {
    ...shipmentRow(shipment),
    destinationCity: order?.address?.city ?? null,
    destinationPincode: order?.address?.pincode ?? null,
    lastScanAt: shipment.lastScanAt ?? null,
    lastScanLocation: shipment.lastScanLocation ?? null,
    packages: shipment.packages ?? [],
    scans: shipment.scans ?? [],
  };
}

function scopedList(collection, sellerId, query, config) {
  return listResult(
    filter(collection, (row) => row.sellerId === sellerId),
    query,
    config,
  );
}

function documentName(type, shipment) {
  return `${type.toLowerCase().replaceAll('_', '-')}-${shipment.id}.pdf`;
}

function createDocument(shipment, type, actorName) {
  const existing = filter(
    'fulfilmentDocuments',
    (doc) => doc.shipmentId === shipment.id && doc.type === type,
  );
  return insert('fulfilmentDocuments', {
    id: id('DOC', 7),
    shipmentId: shipment.id,
    orderId: shipment.orderId,
    sellerId: shipment.sellerId,
    type,
    version: existing.length + 1,
    status: 'READY',
    fileName: documentName(type, shipment),
    mimeType: 'application/pdf',
    createdAt: mockNowIso(),
    createdByName: actorName,
    supersedesId: existing.at(-1)?.id ?? null,
    downloadUrl: null,
  });
}

function documentReadyFor(shipment, type) {
  const order = [
    'PLACED',
    'ACCEPTED',
    'PACKED',
    'MANIFESTED',
    'SHIPPED',
    'IN_TRANSIT',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
  ];
  const required = {
    PACKING_SLIP: 'ACCEPTED',
    TAX_INVOICE: 'PACKED',
    SHIPPING_LABEL: 'MANIFESTED',
    MANIFEST: 'MANIFESTED',
  }[type];
  return required && order.indexOf(shipment.status) >= order.indexOf(required);
}

function pdfArtifact(doc, shipment) {
  const escape = (value) =>
    String(value).replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)');
  const lines = [
    `Arise ${doc.type.replaceAll('_', ' ')}`,
    `Document version ${doc.version}`,
    `Shipment ${shipment.id}`,
    `Order ${shipment.orderId}`,
  ];
  const commands = lines
    .map(
      (line, index) =>
        `BT /F1 ${index === 0 ? 16 : 11} Tf 50 ${760 - index * 26} Td (${escape(line)}) Tj ET`,
    )
    .join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${commands.length} >>\nstream\n${commands}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return pdf;
}

export const sellerLogisticsHandlers = [
  mswHttp.get(`${SELLER_BASE}/orders/processing`, ({ request }) => {
    const ctx = context(request);
    if (ctx.response) return ctx.response;
    const url = new URL(request.url);
    const queue = url.searchParams.get('queue') ?? 'ACCEPTANCE';
    const rows = sellerOrders(ctx.user.sellerId).map((row) => ({
      ...row,
      queue:
        row.status === 'PLACED'
          ? 'ACCEPTANCE'
          : row.status === 'ACCEPTED'
            ? 'PICK'
            : row.status === 'PACKED'
              ? 'PACK'
              : row.status === 'MANIFESTED'
                ? 'HANDOVER'
                : row.slaBreached
                  ? 'OVERDUE'
                  : 'OTHER',
    }));
    const selected =
      queue === 'ALL'
        ? rows.filter((row) => ['NEW', 'PROCESSING'].includes(row.stage))
        : queue === 'OVERDUE'
          ? rows.filter((row) => row.slaBreached)
          : rows.filter((row) => row.queue === queue);
    const query = parseListQuery(url, { defaultSort: 'dispatchByAt' });
    const { items, meta } = listResult(selected, query, {
      searchFields: ['orderId', 'id', 'awb'],
      filterSpec: { fulfillmentType: 'fulfillmentType' },
      sortable: ['dispatchByAt', 'placedAt'],
    });
    return okList(items, {
      ...meta,
      counts: Object.fromEntries(
        ['ACCEPTANCE', 'PICK', 'PACK', 'HANDOVER', 'OVERDUE'].map((key) => [
          key,
          key === 'OVERDUE'
            ? rows.filter((row) => row.slaBreached).length
            : rows.filter((row) => row.queue === key).length,
        ]),
      ),
    });
  }),

  mswHttp.post(`${SELLER_BASE}/orders/:id/packages`, async ({ request, params }) => {
    const ctx = context(request);
    if (ctx.response) return ctx.response;
    const shipment = ownShipment(ctx.user, params.id);
    if (!shipment) return notFound('That fulfilment is not on your account.');
    if (!['ACCEPTED', 'PACKED'].includes(shipment.status))
      return conflict(
        'Packages can only be recorded after acceptance and before handover.',
        'ILLEGAL_TRANSITION',
      );
    const body = await request.json();
    const specs = Array.isArray(body.packages) ? body.packages : [body];
    const ownedItems = filter(
      'orderItems',
      (item) =>
        item.shipmentId === shipment.id && !['CANCELLED', 'PAYMENT_FAILED'].includes(item.status),
    );
    const ownedIds = new Set(ownedItems.map((item) => item.id));
    const assigned = new Set();
    const packages = [];
    for (const spec of specs) {
      const itemIds = spec.itemIds ?? [];
      if (
        !itemIds.length ||
        itemIds.some((itemId) => !ownedIds.has(itemId) || assigned.has(itemId))
      )
        return validationFailed({
          itemIds: 'Each package must contain unique items from this fulfilment.',
        });
      if (!(Number(spec.weightG) > 0) || !spec.dimsCm?.l || !spec.dimsCm?.w || !spec.dimsCm?.h)
        return validationFailed({ package: 'Record actual weight and all package dimensions.' });
      itemIds.forEach((itemId) => assigned.add(itemId));
      packages.push({
        id: id('PKG', 6),
        itemIds,
        weightG: Number(spec.weightG),
        dimsCm: spec.dimsCm,
        createdAt: mockNowIso(),
      });
    }
    update('shipments', shipment.id, { packages, updatedAt: mockNowIso() });
    scheduleSave();
    return ok({ packages });
  }),

  mswHttp.post(`${SELLER_BASE}/orders/:id/split`, async ({ request, params }) => {
    const ctx = context(request);
    if (ctx.response) return ctx.response;
    const shipment = ownShipment(ctx.user, params.id);
    if (!shipment) return notFound('That fulfilment is not on your account.');
    if (!['PLACED', 'ACCEPTED'].includes(shipment.status))
      return conflict('This fulfilment can no longer be split.', 'ILLEGAL_TRANSITION');
    const body = await request.json();
    const itemIds = body.itemIds ?? [];
    const items = filter('orderItems', (item) => item.shipmentId === shipment.id);
    if (
      !itemIds.length ||
      itemIds.length >= items.length ||
      itemIds.some((itemId) => !items.some((item) => item.id === itemId))
    )
      return validationFailed({
        itemIds: 'Move some, but not all, items into the split shipment.',
      });
    const split = insert('shipments', {
      ...shipment,
      id: id('SHP', 7),
      status: shipment.status,
      awb: null,
      courierId: null,
      courierName: null,
      manifestId: null,
      packages: [],
      scans: [],
      splitFromShipmentId: shipment.id,
      version: 1,
    });
    itemIds.forEach((itemId) => update('orderItems', itemId, { shipmentId: split.id }));
    scheduleSave();
    return created(logisticsRow(split));
  }),

  mswHttp.post(`${SELLER_BASE}/orders/:id/scan`, async ({ request, params }) => {
    const ctx = context(request);
    if (ctx.response) return ctx.response;
    const shipment = ownShipment(ctx.user, params.id);
    if (!shipment) return notFound('That fulfilment is not on your account.');
    const body = await request.json();
    const purpose = body.purpose ?? 'PACK';
    const barcode = String(body.barcode ?? '').trim();
    if (!barcode) return validationFailed({ barcode: 'Scan a barcode.' });
    let itemId = null;
    if (purpose === 'PACK') {
      const item = filter('orderItems', (row) => row.shipmentId === shipment.id).find((row) => {
        const variant = findById('variants', row.variantId);
        return [variant?.sku, variant?.ean, row.id].includes(barcode);
      });
      if (!item)
        return badRequest('That barcode is not part of this fulfilment.', 'BARCODE_MISMATCH');
      itemId = item.id;
    } else if (purpose === 'HANDOVER' && ![shipment.awb, shipment.id].includes(barcode))
      return badRequest('Scan this shipment AWB before handover.', 'BARCODE_MISMATCH');
    else if (!['PACK', 'HANDOVER'].includes(purpose))
      return badRequest('Unknown scan purpose.', 'BAD_PURPOSE');
    const scan = {
      id: id('SCN', 7),
      purpose,
      barcode,
      itemId,
      scannedAt: mockNowIso(),
      actorName: ctx.user.name,
    };
    update('shipments', shipment.id, { scans: [...(shipment.scans ?? []), scan] });
    scheduleSave();
    return created(scan);
  }),

  mswHttp.get(`${SELLER_BASE}/orders/:id/documents`, ({ request, params }) => {
    const ctx = context(request);
    if (ctx.response) return ctx.response;
    const shipment = ownShipment(ctx.user, params.id);
    if (!shipment) return notFound('That fulfilment is not on your account.');
    return ok(
      filter('fulfilmentDocuments', (doc) => doc.shipmentId === shipment.id).map((doc) => ({
        ...doc,
        downloadUrl: `/logistics/documents/${doc.id}/download`,
      })),
    );
  }),

  mswHttp.post(`${SELLER_BASE}/orders/:id/documents/:type`, ({ request, params }) => {
    const ctx = context(request);
    if (ctx.response) return ctx.response;
    const shipment = ownShipment(ctx.user, params.id);
    if (!shipment) return notFound('That fulfilment is not on your account.');
    const type = String(params.type).toUpperCase();
    if (!documentReadyFor(shipment, type))
      return conflict(
        'This document is not available at the current fulfilment stage.',
        'DOCUMENT_NOT_READY',
      );
    const doc = createDocument(shipment, type, ctx.user.name);
    doc.downloadUrl = `/logistics/documents/${doc.id}/download`;
    scheduleSave();
    return created(doc);
  }),

  mswHttp.get(`${SELLER_BASE}/logistics/documents/:id/download`, ({ request, params }) => {
    const ctx = context(request);
    if (ctx.response) return ctx.response;
    const doc = findById('fulfilmentDocuments', params.id);
    if (!doc || doc.sellerId !== ctx.user.sellerId)
      return notFound('That document does not exist.');
    const shipment = findById('shipments', doc.shipmentId);
    return new Response(pdfArtifact(doc, shipment), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${doc.fileName}"`,
      },
    });
  }),

  mswHttp.post(`${SELLER_BASE}/logistics/batch`, async ({ request }) => {
    const ctx = context(request);
    if (ctx.response) return ctx.response;
    const body = await request.json();
    const ids = body.ids ?? [];
    const results = [];
    for (const shipmentId of ids) {
      const shipment = ownShipment(ctx.user, shipmentId);
      if (!shipment) {
        results.push({ id: shipmentId, ok: false, error: 'Not found' });
        continue;
      }
      if (body.action === 'HANDOVER') {
        if (
          shipment.status !== 'MANIFESTED' ||
          !(shipment.scans ?? []).some((scan) => scan.purpose === 'HANDOVER')
        ) {
          results.push({ id: shipmentId, ok: false, error: 'Scan the AWB and manifest first.' });
          continue;
        }
        update('shipments', shipment.id, {
          status: 'SHIPPED',
          handedOverAt: mockNowIso(),
          lastScanAt: mockNowIso(),
          lastScanLocation: 'Origin hub',
        });
        filter('orderItems', (item) => item.shipmentId === shipment.id).forEach((item) => {
          update('orderItems', item.id, { status: 'SHIPPED' });
          recordEvent({
            orderId: shipment.orderId,
            itemId: item.id,
            status: 'SHIPPED',
            actorType: 'SELLER',
            actorName: ctx.user.name,
            note: 'Scanned handover',
          });
        });
        refreshOrder(shipment.orderId);
        results.push({ id: shipmentId, ok: true });
        continue;
      }
      const type = body.documentType;
      if (body.action !== 'GENERATE_DOCUMENTS' || !documentReadyFor(shipment, type)) {
        results.push({ id: shipmentId, ok: false, error: 'Action is not legal at this stage.' });
        continue;
      }
      const doc = createDocument(shipment, type, ctx.user.name);
      results.push({ id: shipmentId, ok: true, documentId: doc.id });
    }
    scheduleSave();
    return ok({
      succeeded: results.filter((row) => row.ok).length,
      failed: results.filter((row) => !row.ok).length,
      results,
    });
  }),

  mswHttp.get(`${SELLER_BASE}/logistics/shipments`, ({ request }) => {
    const ctx = context(request);
    if (ctx.response) return ctx.response;
    const query = parseListQuery(new URL(request.url), { defaultSort: '-lastScanAt' });
    const { items, meta } = scopedList('shipments', ctx.user.sellerId, query, {
      searchFields: ['id', 'orderId', 'awb', 'courierName'],
      filterSpec: { status: 'status', courierId: 'courierId' },
      sortable: ['lastScanAt', 'promisedDate', 'status'],
    });
    return okList(items.map(logisticsRow), meta);
  }),

  mswHttp.get(`${SELLER_BASE}/logistics/pickups`, ({ request }) => {
    const ctx = context(request);
    if (ctx.response) return ctx.response;
    const query = parseListQuery(new URL(request.url), { defaultSort: '-date' });
    const rows = filter('manifests', (row) => row.originId === ctx.user.sellerId);
    const { items, meta } = listResult(rows, query, {
      searchFields: ['id', 'courierName', 'originName'],
      filterSpec: { status: 'status' },
      sortable: ['date', 'status', 'shipmentCount'],
    });
    return okList(items, meta);
  }),

  mswHttp.post(`${SELLER_BASE}/logistics/pickups/:id/reschedule`, async ({ request, params }) => {
    const ctx = context(request);
    if (ctx.response) return ctx.response;
    const manifest = findById('manifests', params.id);
    if (!manifest || manifest.originId !== ctx.user.sellerId)
      return notFound('That pickup is not on your account.');
    if (manifest.status === 'PICKED_UP')
      return conflict('This pickup already happened.', 'ALREADY_PICKED_UP');
    const body = await request.json();
    if (!body.date) return validationFailed({ date: 'Choose a date.' });
    update('manifests', manifest.id, {
      date: body.date,
      slot: body.slot ?? manifest.slot,
      status: 'SCHEDULED',
      attempts: Number(manifest.attempts ?? 0) + 1,
    });
    scheduleSave();
    return ok(findById('manifests', manifest.id));
  }),

  mswHttp.get(`${SELLER_BASE}/logistics/ndr`, ({ request }) => {
    const ctx = context(request);
    if (ctx.response) return ctx.response;
    const shipmentIds = new Set(
      filter('shipments', (row) => row.sellerId === ctx.user.sellerId).map((row) => row.id),
    );
    const rows = filter('ndrRecords', (row) => shipmentIds.has(row.shipmentId)).map((row) => ({
      ...row,
      overdue: row.status === 'OPEN' && new Date(row.actionDueAt).getTime() < mockNow(),
    }));
    const { items, meta } = listResult(
      rows,
      parseListQuery(new URL(request.url), { defaultSort: 'actionDueAt' }),
      {
        searchFields: ['id', 'awb', 'orderId', 'reason'],
        filterSpec: { status: 'status', overdue: { path: 'overdue', kind: 'boolean' } },
        sortable: ['actionDueAt', 'openedAt', 'attempt'],
      },
    );
    return okList(items, meta);
  }),

  mswHttp.post(`${SELLER_BASE}/logistics/ndr/:id/respond`, async ({ request, params }) => {
    const ctx = context(request);
    if (ctx.response) return ctx.response;
    const row = findById('ndrRecords', params.id);
    const shipment = row ? ownShipment(ctx.user, row.shipmentId) : null;
    if (!row || !shipment) return notFound('That NDR is not on your account.');
    if (row.status !== 'OPEN')
      return conflict('This NDR has already been actioned.', 'ALREADY_ACTIONED');
    if (new Date(row.actionDueAt).getTime() < mockNow())
      return conflict('The seller response window has closed.', 'NDR_SLA_EXPIRED');
    const body = await request.json();
    if (!['REATTEMPT', 'RTO'].includes(body.action))
      return validationFailed({ action: 'Choose reattempt or RTO.' });
    if (body.action === 'RTO' && !String(body.reason ?? '').trim())
      return validationFailed({ reason: 'Give an RTO reason.' });
    const nextStatus = body.action === 'REATTEMPT' ? 'REATTEMPT_REQUESTED' : 'RTO_REQUESTED';
    update('ndrRecords', row.id, {
      status: nextStatus,
      resolution: body.action,
      sellerResponse: body.note ?? body.reason ?? null,
      sellerRespondedAt: mockNowIso(),
      sellerRespondedBy: ctx.user.name,
    });
    if (body.action === 'RTO') update('shipments', shipment.id, { status: 'RTO_INITIATED' });
    filter('orderItems', (item) => item.shipmentId === shipment.id).forEach((item) =>
      recordEvent({
        orderId: shipment.orderId,
        itemId: item.id,
        status: body.action === 'RTO' ? 'RTO_INITIATED' : 'NDR_REATTEMPT_REQUESTED',
        actorType: 'SELLER',
        actorName: ctx.user.name,
        note: body.note ?? body.reason,
      }),
    );
    scheduleSave();
    return ok(findById('ndrRecords', row.id));
  }),

  mswHttp.get(`${SELLER_BASE}/logistics/rto`, ({ request }) => {
    const ctx = context(request);
    if (ctx.response) return ctx.response;
    const rows = filter(
      'shipments',
      (row) => row.sellerId === ctx.user.sellerId && row.status.startsWith('RTO'),
    ).map(logisticsRow);
    const { items, meta } = listResult(
      rows,
      parseListQuery(new URL(request.url), { defaultSort: '-lastScanAt' }),
      {
        searchFields: ['id', 'awb', 'orderId'],
        filterSpec: { status: 'status' },
        sortable: ['lastScanAt', 'status'],
      },
    );
    return okList(items, meta);
  }),

  mswHttp.get(`${SELLER_BASE}/logistics/weight-disputes`, ({ request }) => {
    const ctx = context(request);
    if (ctx.response) return ctx.response;
    const { items, meta } = scopedList(
      'weightDisputes',
      ctx.user.sellerId,
      parseListQuery(new URL(request.url), { defaultSort: '-raisedAt' }),
      {
        searchFields: ['id', 'awb', 'orderId', 'sku'],
        filterSpec: { status: 'status' },
        sortable: ['raisedAt', 'respondByAt', 'extraChargePaise'],
      },
    );
    return okList(items, meta);
  }),

  mswHttp.post(
    `${SELLER_BASE}/logistics/weight-disputes/:id/dispute`,
    async ({ request, params }) => {
      const ctx = context(request);
      if (ctx.response) return ctx.response;
      const row = findById('weightDisputes', params.id);
      if (!row || row.sellerId !== ctx.user.sellerId)
        return notFound('That weight charge is not on your account.');
      if (['ACCEPTED', 'REJECTED', 'AUTO_ACCEPTED'].includes(row.status))
        return conflict('This weight charge has already been resolved.', 'ALREADY_DECIDED');
      if (new Date(row.respondByAt).getTime() < mockNow())
        return conflict('The dispute window has closed.', 'DISPUTE_WINDOW_CLOSED');
      const body = await request.json();
      const evidence = body.evidence ?? [];
      if (
        !String(body.reason ?? '').trim() ||
        !evidence.length ||
        evidence.some((item) => !(item.mediaId ?? item.id))
      )
        return validationFailed({ evidence: 'Give a reason and attach durable evidence.' });
      update('weightDisputes', row.id, {
        status: 'DISPUTED_BY_SELLER',
        disputeReason: body.reason,
        sellerEvidence: evidence,
        disputedAt: mockNowIso(),
        disputedByName: ctx.user.name,
      });
      scheduleSave();
      return ok(findById('weightDisputes', row.id));
    },
  ),
];
