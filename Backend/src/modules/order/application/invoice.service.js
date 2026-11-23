import PDFDocument from 'pdfkit';
import { env } from '../../../config/env.js';
import { logger } from '../../../config/logger.js';
import { AppError, NotFoundError } from '../../../shared/errors/AppError.js';
import { signFileToken } from '../../../shared/utils/signedUrl.js';
import { getSettingsSection } from '../../admin/public/index.js';
import { getSellerTaxProfile } from '../../identity/public/index.js';
import { financialYear, isIntraState, taxLine, totalsOf } from '../domain/services/invoiceRules.js';
import { SUB } from '../domain/services/orderStatus.js';
import { Counter, Invoice } from '../infrastructure/persistence/invoice.model.js';
import { Order } from '../infrastructure/persistence/order.model.js';
import { notifyInvoiceIssued } from './orderNotifications.js';

const SERVICE_GST_RATE = 18; // delivery and Arise's fee are services taxed at 18%
const DELIVERY_SAC = '996812';
const FEE_SAC = '998599';
// shortcut: placeholders until Arise's real details are saved in Settings > General; replace then.
const DUMMY_GSTIN = '29ABCDE1234F1Z5';
const DUMMY_STATE = 'Karnataka';
const ARISE = 'ARISE';
const failure = (status, code, message) => new AppError({ code, message, status });

/**
 * Next number in the supplier's own gapless series for the financial year, at most 16 characters (GST's limit):
 * `<code>/<yyyy>/<5-digit serial>`, credit notes with a C in front, e.g. `7C3A/2627/00001`, `CARS/2627/00001`.
 */
async function nextNumber(supplierKey, docType, at) {
  const fy = financialYear(at);
  const [{ invoiceSeriesPrefix }, counter] = await Promise.all([
    getSettingsSection('tax'),
    Counter.findOneAndUpdate({ _id: `${supplierKey}:${docType}:${fy}` }, { $inc: { seq: 1 } }, { upsert: true, new: true }),
  ]);
  const code = supplierKey === ARISE ? invoiceSeriesPrefix.split('/')[0].slice(0, 4) : supplierKey.slice(-4).toUpperCase();
  return { fy, seq: counter.seq, number: `${docType === 'CREDIT_NOTE' ? 'C' : ''}${code}/${fy.slice(2, 4)}${fy.slice(5)}/${String(counter.seq).padStart(5, '0')}` };
}

/** Writes a document once: a second call with the same key (or a race) returns the one already there. */
async function save(order, spec) {
  const existing = await Invoice.findOne({ key: spec.key });
  if (existing) return { doc: existing, created: false };
  const { name, line, city, state, pincode } = order.address;
  const supplierKey = spec.sellerId ?? ARISE;
  try {
    // shortcut: a lost race burns one number (a gap in the series); use a transaction if an auditor objects.
    const doc = await Invoice.create({
      docType: 'INVOICE', ...spec, supplierKey, ...(await nextNumber(supplierKey, spec.docType ?? 'INVOICE', new Date())),
      orderId: order._id, orderNumber: order.number, customerId: order.customerId,
      buyer: { name, address: `${line}, ${city}`, state, pincode },
    });
    return { doc, created: true };
  } catch (error) {
    const raced = error.code === 11000 && (await Invoice.findOne({ key: spec.key }));
    if (raced) return { doc: raced, created: false };
    throw error;
  }
}

async function ariseDetails(deliveryState) {
  const general = await getSettingsSection('general');
  const registration = general.gstins?.find((entry) => isIntraState(entry.state, deliveryState)) ?? general.gstins?.[0]; // registered in the buyer's state? supply is local
  return { name: general.legalEntityName || `${general.platformName} (dummy details)`, gstin: registration?.gstin ?? DUMMY_GSTIN, state: registration?.state ?? DUMMY_STATE, address: general.businessAddress || 'Registered office not set' };
}

/** Works out who supplies what on a fresh invoice: the seller's parcel (GOODS) or Arise's platform fee. A seller without a GSTIN gets a bill of supply with no GST. */
async function compose(order, kind, sub) {
  if (kind === 'PLATFORM_FEE') {
    const supplier = await ariseDetails(order.address.state);
    const intra = isIntraState(supplier.state, order.address.state);
    const lines = [
      { description: 'Platform fee', paidPaise: order.totals.platformFeePaise },
      { description: 'Cash on delivery fee', paidPaise: order.totals.codFeePaise ?? 0 },
    ].filter((fee) => fee.paidPaise > 0).map((fee) => taxLine({ ...fee, hsn: FEE_SAC, gstRate: SERVICE_GST_RATE, intra }));
    return { kind, key: `INV:FEE:${order._id}`, sellerId: null, subOrderId: null, supplier, taxable: true, intraState: intra, lines, totals: totalsOf(lines) };
  }
  const tax = (await getSellerTaxProfile(sub.sellerId)) ?? {};
  const taxable = Boolean(tax.gstin);
  const supplier = { name: tax.name ?? sub.sellerName, gstin: tax.gstin ?? null, state: tax.state ?? null, address: tax.address ?? '' };
  const intra = isIntraState(supplier.state, order.address.state);
  const make = (fields) => taxLine({ ...fields, intra, ...(taxable ? {} : { gstRate: 0, gstPaise: 0 }) });
  const lines = sub.items.map((item) => make({
    description: `${item.name}${item.variantLabel && item.variantLabel !== 'Standard' ? ` - ${item.variantLabel}` : ''}`, hsn: item.hsnCode, quantity: item.quantity,
    paidPaise: item.amountPaise - item.discountPaise, gstRate: item.gstRate, gstPaise: item.gstPaise,
  }));
  const deliveryPaise = sub.shippingPaise - sub.shippingDiscountPaise;
  if (deliveryPaise > 0) lines.push(make({ description: 'Delivery charges', hsn: DELIVERY_SAC, paidPaise: deliveryPaise, gstRate: SERVICE_GST_RATE }));
  return { kind, key: `INV:${sub._id}`, sellerId: String(sub.sellerId), subOrderId: sub._id, supplier, taxable, intraState: intra, lines, totals: totalsOf(lines) };
}

/**
 * Called when a parcel becomes READY_TO_SHIP, and safe to call again: issues the seller's invoice for the parcel and, the first
 * time any parcel of the order gets here, Arise's invoice for its platform fee. Returns the parcel's invoice.
 */
export async function issueInvoices(orderId, subOrderId) {
  const order = await Order.findById(orderId);
  const sub = order?.subOrders.id(subOrderId);
  if (!sub) throw new NotFoundError('Order not found.');
  const goods = await save(order, await compose(order, 'GOODS', sub));
  if (goods.created) notifyInvoiceIssued(order, goods.doc);
  if (order.totals.platformFeePaise + (order.totals.codFeePaise ?? 0) > 0) await save(order, await compose(order, 'PLATFORM_FEE'));
  return goods.doc;
}

/**
 * Any parcel that is past "accept" and not cancelled must have an invoice, whatever its status now. Parcels handed over before
 * invoicing existed (or whose issue failed) get theirs the first time anyone asks for the order's documents. Safe to repeat.
 */
export async function ensureInvoices(order) {
  const due = order?.subOrders.filter((sub) => ![SUB.CONFIRMED, SUB.ACCEPTED, SUB.CANCELLED].includes(sub.status)) ?? [];
  if (!due.length) return;
  const have = new Set((await Invoice.find({ orderId: order._id, docType: 'INVOICE', kind: 'GOODS' }, 'subOrderId').lean()).map((row) => String(row.subOrderId)));
  for (const sub of due) if (!have.has(String(sub._id))) await issueInvoices(order._id, sub._id);
}

const ownParcelOrder = (sellerId, subOrderId) => Order.findOne({ subOrders: { $elemMatch: { _id: subOrderId, sellerId: String(sellerId) } } });

// goodsOnly: the delivery service was still rendered (a parcel returned undelivered), so only the goods are credited.
// line: credit just that one line (a returned item); `key` then names the return, since one invoice can be credited several times.
const creditNoteSpec = (invoice, reason, { goodsOnly = false, line = null, key = `CN:${invoice._id}` } = {}) => {
  const { kind, taxable, sellerId, subOrderId, supplier, intraState, ...rest } = invoice.toObject();
  const partial = line !== null || goodsOnly;
  const lines = line !== null ? [rest.lines[line]] : goodsOnly ? rest.lines.filter((entry) => entry.hsn !== DELIVERY_SAC) : rest.lines;
  const totals = partial ? totalsOf(lines) : rest.totals;
  return { key, docType: 'CREDIT_NOTE', kind, taxable, sellerId, subOrderId, supplier, intraState, lines, totals, refInvoiceId: invoice._id, refNumber: invoice.number, reason };
};

/**
 * Parcels were cancelled after their invoice was issued (an admin cancelling a handed-over parcel): each live invoice of
 * those parcels gets a credit note, and so does Arise's platform-fee invoice when `withFee` (nothing is left of the order).
 * Safe to call again. Never throws: the cancellation has already happened and this is only its paperwork.
 */
export async function issueCreditNotes(orderId, cancelledSubIds, { withFee = false, reason = 'Order cancelled', goodsOnly = false } = {}) {
  try {
    const order = await Order.findById(orderId);
    const invoices = await Invoice.find({ orderId, docType: 'INVOICE', supersededBy: null, $or: [{ subOrderId: { $in: cancelledSubIds } }, ...(withFee ? [{ kind: 'PLATFORM_FEE' }] : [])] });
    for (const invoice of invoices) {
      const { doc, created } = await save(order, creditNoteSpec(invoice, reason, { goodsOnly }));
      if (created) notifyInvoiceIssued(order, doc);
    }
  } catch (err) {
    logger.error({ err, orderId: String(orderId) }, 'Could not issue credit notes for a cancellation');
  }
}

/**
 * Corrects an invoice (say the seller's GSTIN was added after it went out): a credit note cancels it and a fresh invoice is
 * issued from today's seller and tax details. The old invoice stays on record, marked superseded.
 */
export async function regenerateInvoice(invoiceId, reason) {
  const old = await Invoice.findById(invoiceId);
  if (!old) throw new NotFoundError('Invoice not found.');
  if (old.docType !== 'INVOICE' || old.supersededBy) throw failure(409, 'NOT_REGENERABLE', 'Only a live invoice can be re-generated.');
  const order = await Order.findById(old.orderId);
  const sub = old.subOrderId && order.subOrders.id(old.subOrderId);
  if (sub?.status === SUB.CANCELLED || await Invoice.exists({ refInvoiceId: old._id })) throw failure(409, 'NOT_REGENERABLE', 'This invoice was already cancelled by a credit note.');
  await save(order, creditNoteSpec(old, reason));
  const spec = await compose(order, old.kind, sub);
  const { doc } = await save(order, { ...spec, key: `${spec.key}:v${(await Invoice.countDocuments({ orderId: old.orderId, subOrderId: old.subOrderId, docType: 'INVOICE' })) + 1}` });
  old.supersededBy = doc._id;
  await old.save();
  notifyInvoiceIssued(order, doc);
  return doc;
}

/* ---------------------------------------------------------------------------------------------------- reads */

const isLive = { docType: 'INVOICE', supersededBy: null };

/** Live invoice number per parcel, for the seller's order rows. */
export async function invoiceNumbersBySubOrder(subOrderIds) {
  const rows = await Invoice.find({ subOrderId: { $in: subOrderIds }, ...isLive }, 'subOrderId number').lean();
  return new Map(rows.map((row) => [String(row.subOrderId), row.number]));
}

const typeOf = (row) => (row.docType === 'CREDIT_NOTE' ? 'CREDIT_NOTE' : row.taxable ? 'TAX_INVOICE' : 'BILL_OF_SUPPLY');
const fileNameOf = (row) => `${row.number.replaceAll('/', '-')}.pdf`;

/** Every tax document of one parcel (invoice, corrections, credit notes), oldest first: the seller's document centre rows. */
export async function sellerDocumentsOf(sellerId, subOrderId, urlFor) {
  const rows = await Invoice.find({ sellerId: String(sellerId), subOrderId }).sort({ _id: 1 }).lean();
  return rows.map((row, index) => ({ id: String(row._id), type: typeOf(row), number: row.number, version: index + 1, createdAt: row.issuedAt.toISOString(), fileName: fileNameOf(row), downloadUrl: urlFor(row._id) }));
}

export async function getSellerInvoice(sellerId, { invoiceId, subOrderId }) {
  if (subOrderId) await ensureInvoices(await ownParcelOrder(sellerId, subOrderId));
  const invoice = await Invoice.findOne({ sellerId: String(sellerId), ...(invoiceId ? { _id: invoiceId } : { subOrderId, ...isLive }) });
  if (!invoice) throw new NotFoundError('No invoice yet: it is issued when the order is ready to ship.');
  return invoice;
}

/** The invoices of a set of parcels the seller owns, for printing together. */
export async function getSellerInvoices(sellerId, subOrderIds) {
  for (const id of subOrderIds) await ensureInvoices(await ownParcelOrder(sellerId, id));
  const rows = await Invoice.find({ sellerId: String(sellerId), subOrderId: { $in: subOrderIds }, ...isLive }).sort({ _id: 1 });
  if (!rows.length) throw new NotFoundError('None of these orders has an invoice yet.');
  return rows;
}

const money = (row) => ({ taxablePaise: row.totals.taxablePaise, taxPaise: row.totals.cgstPaise + row.totals.sgstPaise + row.totals.igstPaise, totalPaise: row.totals.totalPaise });
const rowOf = (row) => ({
  id: String(row._id), number: row.number, invoiceNo: row.number, orderId: row.orderNumber, customerName: row.buyer.name, // invoiceNo/orderId/customerName: the names the panels' tables read
   type: typeOf(row), kind: row.kind, orderNumber: row.orderNumber, subOrderId: row.subOrderId ? String(row.subOrderId) : null,
  sellerId: row.sellerId, supplierName: row.supplier.name, supplierGstin: row.supplier.gstin, placeOfSupply: row.buyer.state, issuedAt: row.issuedAt,
  refNumber: row.refNumber, reason: row.reason, superseded: Boolean(row.supersededBy), ...money(row),
});

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Documents a page at a time, newest first; `scope` pins the seller. Shared by the seller and admin lists. */
export async function listInvoices({ page = 1, pageSize = 25, q, type, kind, sellerId, from, to }, scope = {}) {
  const search = q ? new RegExp(escapeRegex(q), 'i') : null;
  const filter = {
    ...scope,
    ...(type === 'CREDIT_NOTE' ? { docType: 'CREDIT_NOTE' } : type === 'BILL_OF_SUPPLY' ? { docType: 'INVOICE', taxable: false } : type === 'TAX_INVOICE' ? { docType: 'INVOICE', taxable: true } : {}),
    ...(kind ? { kind } : {}),
    ...(sellerId ? { sellerId: String(sellerId) } : {}),
    ...(from || to ? { issuedAt: { ...(from ? { $gte: new Date(from) } : {}), ...(to ? { $lte: new Date(to) } : {}) } } : {}),
    ...(search ? { $or: [{ number: search }, { orderNumber: search }, { 'supplier.name': search }, { 'supplier.gstin': search }] } : {}),
  };
  const [rows, total] = await Promise.all([Invoice.find(filter).sort({ _id: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(), Invoice.countDocuments(filter)]);
  return { data: rows.map(rowOf), meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) } };
}

export async function getInvoiceById(invoiceId, scope = {}) {
  const invoice = await Invoice.findOne({ _id: invoiceId, ...scope });
  if (!invoice) throw new NotFoundError('Invoice not found.');
  return invoice;
}

/** Documents of one order, for the admin order page. */
export async function listOrderInvoices(orderId) {
  await ensureInvoices(await Order.findById(orderId));
  return (await Invoice.find({ orderId }).sort({ _id: 1 }).lean()).map(rowOf);
}

/** Download link that works without a login header (a browser or the app opening it): scoped to one document, short-lived. */
export const signedInvoiceUrl = (invoiceId, ttlSeconds = 600) => `${env.PUBLIC_ORIGIN}/api/customer/v1/invoices/${invoiceId}/file?token=${signFileToken(`invoice:${invoiceId}`, ttlSeconds)}`;

export async function listCustomerInvoices(customerId, orderId) {
  await ensureInvoices(await Order.findOne({ _id: orderId, customerId: String(customerId) }));
  const rows = await Invoice.find({ customerId: String(customerId), orderId }).sort({ _id: 1 }).lean();
  return rows.map((row) => ({ ...rowOf(row), downloadUrl: signedInvoiceUrl(row._id) }));
}

/** The customer's own documents; the signed-link route passes no customer because the token already names the document. */
export const getCustomerInvoice = (invoiceId, customerId) => getInvoiceById(invoiceId, customerId ? { customerId: String(customerId) } : {});

/* ------------------------------------------------------------------------------------------------------- PDF */

const rupees = (paise) => `Rs. ${(paise / 100).toFixed(2)}`;

function drawInvoice(doc, invoice) {
  const { supplier, buyer, totals, taxable } = invoice;
  const credit = invoice.docType === 'CREDIT_NOTE';
  const title = credit ? 'CREDIT NOTE' : taxable ? 'TAX INVOICE' : 'BILL OF SUPPLY';
  doc.font('Helvetica-Bold').fontSize(18).text(title, 40, 40, { align: 'center', width: 515 }).moveDown(0.5);
  doc.font('Helvetica').fontSize(10).text(`${credit ? 'Credit note' : 'Invoice'} no: ${invoice.number}`).text(`Date: ${invoice.issuedAt.toISOString().slice(0, 10)}`).text(`Order: ${invoice.orderNumber}`);
  if (credit) doc.text(`Against invoice: ${invoice.refNumber}`).text(`Reason: ${invoice.reason ?? '-'}`);
  if (invoice.supersededBy) doc.fillColor('red').text('SUPERSEDED: replaced by a corrected invoice').fillColor('black');
  doc.moveDown();
  doc.font('Helvetica-Bold').text(credit ? 'Issued by' : 'Sold by').font('Helvetica').text(supplier.name).text(supplier.address || '-').text(`State: ${supplier.state ?? '-'}   GSTIN: ${supplier.gstin ?? 'Not registered'}`).moveDown(0.5);
  doc.font('Helvetica-Bold').text(credit ? 'Credited to' : 'Billed / shipped to').font('Helvetica').text(buyer.name).text(`${buyer.address}, ${buyer.pincode}`).text(`Place of supply: ${buyer.state}`).moveDown();

  const columns = taxable
    ? [['Item', 40, 190], ['HSN/SAC', 230, 50], ['Qty', 280, 30], ['Taxable', 310, 60], ['GST %', 370, 40], [invoice.intraState ? 'CGST+SGST' : 'IGST', 410, 70], ['Total', 480, 75]]
    : [['Item', 40, 270], ['HSN/SAC', 310, 60], ['Qty', 370, 40], ['Total', 410, 145]];
  const row = (cells, y) => cells.forEach((cell, index) => doc.text(String(cell), columns[index][1], y, { width: columns[index][2] - 4 }));
  let y = doc.y;
  doc.font('Helvetica-Bold');
  row(columns.map(([label]) => label), y);
  doc.font('Helvetica');
  y += 18;
  for (const line of invoice.lines) {
    row(taxable
      ? [line.description, line.hsn ?? '-', line.quantity, rupees(line.taxablePaise), line.gstRate, rupees(line.cgstPaise + line.sgstPaise + line.igstPaise), rupees(line.paidPaise)]
      : [line.description, line.hsn ?? '-', line.quantity, rupees(line.paidPaise)], y);
    y = Math.max(doc.y, y + 14) + 4;
    if (y > 740) { doc.addPage(); y = 40; }
  }
  const right = { align: 'right', width: 515 };
  doc.font('Helvetica-Bold');
  if (taxable) {
    doc.text(`Taxable value: ${rupees(totals.taxablePaise)}`, 40, y + 10, right);
    doc.text(invoice.intraState ? `CGST: ${rupees(totals.cgstPaise)}   SGST: ${rupees(totals.sgstPaise)}` : `IGST: ${rupees(totals.igstPaise)}`, right);
  } else {
    doc.moveDown(1);
  }
  doc.text(`${credit ? 'Credit note' : 'Invoice'} total: ${rupees(totals.totalPaise)}`, taxable ? undefined : 40, undefined, right);
  doc.font('Helvetica').fontSize(8).moveDown(2).text(taxable ? 'Prices include GST. This is a computer-generated document.' : 'Supplier is not registered under GST: no tax is charged. This is a computer-generated document.', 40, doc.y, { align: 'center', width: 515 });
}

/** Streams one or more documents (one starts each page) as a PDF into `stream` (an HTTP response). */
export function writeInvoicesPdf(invoices, stream) {
  const doc = new PDFDocument({ size: 'A4', margin: 40, autoFirstPage: false });
  doc.pipe(stream);
  for (const invoice of invoices) {
    doc.addPage();
    drawInvoice(doc, invoice);
  }
  doc.end();
}

export const sendPdf = (res, invoices) => {
  const list = [].concat(invoices);
  res.type('application/pdf').attachment(list.length === 1 ? fileNameOf(list[0]) : 'invoices.pdf');
  writeInvoicesPdf(list, res);
};

/**
 * A returned item passed QC: a credit note for just its line of the parcel's invoice (its line is where the item sits in the
 * parcel, the order invoices are written in). Safe to call again; never throws, the refund has already been decided.
 */
export async function issueReturnCreditNote(orderId, subOrderId, itemId, returnId, reason) {
  try {
    const order = await Order.findById(orderId);
    const line = order.subOrders.id(subOrderId).items.findIndex((item) => String(item._id) === String(itemId));
    const invoice = await Invoice.findOne({ orderId, subOrderId, docType: 'INVOICE', kind: 'GOODS', supersededBy: null });
    if (!invoice || line < 0) return;
    const { doc, created } = await save(order, creditNoteSpec(invoice, reason, { line, key: `CN:${invoice._id}:${returnId}` }));
    if (created) notifyInvoiceIssued(order, doc);
  } catch (err) {
    logger.error({ err, orderId: String(orderId), returnId: String(returnId) }, 'Could not issue the credit note for a return');
  }
}
