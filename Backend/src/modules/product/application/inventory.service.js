import { ConflictError, NotFoundError } from '../../../shared/errors/AppError.js';
import { Offer } from '../infrastructure/persistence/offer.model.js';
import { StockMovement } from '../infrastructure/persistence/stockMovement.model.js';

// Seller stock management. One row per offer (a seller's variant), read straight from the Offer collection.
// `reserved` is the units held for checkouts in progress (stockReservation.service). Honest gaps until their modules
// exist: there is no sales velocity, so days of cover and restock suggestions are empty; nothing records when units
// arrived, so no stock is aged; and there are no warehouses or pickup addresses, so the location is the fulfilment kind.
export const LOW_STOCK_UNITS = 10;
const LEDGER_LIMIT = 200;
const ROW_FIELDS = 'productId variantId sellerId sku sellerSku productTitle variantLabel stock reserved fulfillmentType status productStatus version updatedAt';
const AVAILABLE = { $subtract: ['$stock', { $ifNull: ['$reserved', 0] }] };
const SORT_FIELDS = { sellable: 'stock', available: 'stock', productTitle: 'productTitle', updatedAt: 'updatedAt' };

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function inventoryRow(offer) {
  const reserved = offer.reserved ?? 0;
  const available = offer.stock - reserved;
  return {
    id: String(offer._id),
    offerId: String(offer._id),
    productId: String(offer.productId),
    variantId: String(offer.variantId),
    sellerId: offer.sellerId,
    sku: offer.sellerSku || offer.sku,
    productTitle: offer.productTitle ?? 'Listing',
    variantLabel: offer.variantLabel,
    warehouseCode: offer.fulfillmentType === 'ARISE' ? 'Arise fulfilment centre' : 'Your warehouse',
    fulfillmentType: offer.fulfillmentType,
    listingStatus: offer.status,
    sellable: offer.stock,
    reserved,
    available,
    unsellable: 0,
    daysOfCover: null,
    dailyVelocity: null,
    oldestUnitDays: null,
    lowStock: available < LOW_STOCK_UNITS,
    aged: false,
    version: offer.version,
    updatedAt: offer.updatedAt,
  };
}

/** The seller's stock, one page of it, plus counts over all of it (for the summary cards). */
export async function listSellerInventory(sellerId, { page, pageSize, q, sort, fulfillmentType, lowStock, aged }) {
  const filter = { sellerId };
  if (fulfillmentType) filter.fulfillmentType = fulfillmentType;
  if (lowStock) filter.$expr = { $lt: [AVAILABLE, LOW_STOCK_UNITS] };
  if (q) {
    const pattern = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ productTitle: pattern }, { sku: pattern }, { sellerSku: pattern }];
  }
  const sortField = SORT_FIELDS[sort.replace(/^-/, '')] ?? 'stock';
  const direction = sort.startsWith('-') ? -1 : 1;

  // Nothing is aged yet (see above), so that filter is empty without a query.
  const [rows, total, [summary]] = await Promise.all([
    aged ? [] : Offer.find(filter, ROW_FIELDS).sort({ [sortField]: direction, _id: direction }).skip((page - 1) * pageSize).limit(pageSize).lean(),
    aged ? 0 : Offer.countDocuments(filter),
    Offer.aggregate([
      { $match: { sellerId } },
      { $group: { _id: null, skus: { $sum: 1 }, unitsSellable: { $sum: '$stock' }, lowStock: { $sum: { $cond: [{ $lt: [AVAILABLE, LOW_STOCK_UNITS] }, 1, 0] } } } },
    ]),
  ]);
  return {
    data: rows.map(inventoryRow),
    meta: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      counts: { skus: summary?.skus ?? 0, unitsSellable: summary?.unitsSellable ?? 0, lowStock: summary?.lowStock ?? 0, aged: 0 },
    },
  };
}

async function ownOffer(sellerId, offerId) {
  const offer = await Offer.findOne({ _id: offerId, sellerId }, ROW_FIELDS).lean();
  if (!offer) throw new NotFoundError('That stock record is not on your account.');
  return offer;
}

/** Newest movements first (the latest 200), with the row they belong to. */
export async function getStockLedger(sellerId, offerId) {
  const offer = await ownOffer(sellerId, offerId);
  const movements = await StockMovement.find({ offerId }).sort({ at: -1, _id: -1 }).limit(LEDGER_LIMIT).lean();
  return {
    inventory: inventoryRow(offer),
    entries: movements.map((m) => ({ id: String(m._id), type: m.type, qty: m.qty, balanceAfter: m.balanceAfter, note: m.note, reference: m.reference, at: m.at })),
  };
}

/**
 * Sets a self-ship offer's sellable stock. `version` is the one the seller saw: if the row changed since (another tab,
 * a listing edit), nothing is written and 409 VERSION_CONFLICT returns the current row. Arise-fulfilled stock only
 * moves through warehouse events, never by hand.
 */
export async function setSellerStock(sellerId, offerId, { sellable, version, note, reference = null }, actor) {
  const offer = await ownOffer(sellerId, offerId);
  if (offer.fulfillmentType === 'ARISE') {
    throw new ConflictError('FBA_STOCK_IMMUTABLE', 'Stock fulfilled by Arise changes only through receiving, adjustment, return or removal movements.');
  }
  const conflict = (row) => (sellable < (row.reserved ?? 0)
    ? new ConflictError('RESERVED_STOCK', `${row.reserved} units are held for checkouts in progress; stock cannot go below that.`, { current: inventoryRow(row) })
    : new ConflictError('VERSION_CONFLICT', 'This stock row changed. Refresh and retry.', { current: inventoryRow(row) }));
  if (offer.version !== version || sellable < (offer.reserved ?? 0)) throw conflict(offer);
  if (offer.stock === sellable) return inventoryRow(offer);

  // The reserved guard sits in the write itself: a checkout may hold units between the read above and this update.
  const updated = await Offer.findOneAndUpdate(
    { _id: offerId, sellerId, version, $expr: { $lte: [{ $ifNull: ['$reserved', 0] }, sellable] } }, // offers saved before reservations have no field
    { $set: { stock: sellable }, $inc: { version: 1 } },
    { new: true, projection: ROW_FIELDS },
  ).lean();
  if (!updated) throw conflict(await ownOffer(sellerId, offerId));

  // shortcut: the ledger row is written after the stock, not in one transaction; move both into withTransaction once
  // every deployment runs MongoDB as a replica set.
  await StockMovement.create({
    offerId, sellerId, type: 'ADJUSTMENT', qty: sellable - offer.stock, balanceAfter: sellable, note, reference, actorId: actor?.userId ?? null, at: new Date(),
  });
  return inventoryRow(updated);
}

/** Ledger entries for stock changed while editing a listing (the listing flow saves the offers itself). */
export async function recordListingStockEdits(changes, actor) {
  if (!changes.length) return;
  const at = new Date();
  await StockMovement.insertMany(changes.map(({ offer, before }) => ({
    offerId: offer._id, sellerId: offer.sellerId, type: 'LISTING_EDIT', qty: offer.stock - before, balanceAfter: offer.stock,
    note: 'Changed while editing the listing', actorId: actor?.userId ?? null, at,
  })));
}
