import { filter, findById } from '@mocks/db/store';
import { mockNowIso } from '@mocks/engine/settings';

const sum = (rows, key) => rows.reduce((total, row) => total + Number(row[key] ?? 0), 0);
const pct = (a, b) => b ? Number(((a / b) * 100).toFixed(2)) : 0;

function range(params) {
  const to = params.get('to') ?? mockNowIso().slice(0, 10);
  const from = params.get('from') ?? new Date(new Date(to).getTime() - 29 * 86400_000).toISOString().slice(0, 10);
  return { from, to, compare: params.get('compare') === 'true', timezone: params.get('timezone') ?? 'Asia/Kolkata' };
}

function scoped(sellerId, params) {
  const period = range(params);
  const warehouseInventory = params.get('warehouseId') ? filter('inventory', (row) => row.sellerId === sellerId && row.warehouseId === params.get('warehouseId')) : null;
  const warehouseProducts = warehouseInventory ? new Set(warehouseInventory.map((row) => row.productId)) : null;
  const warehouseSkus = warehouseInventory ? new Set(warehouseInventory.map((row) => row.sku)) : null;
  const productAllowed = (productId) => {
    const product = findById('products', productId);
    if (params.get('categoryId') && product?.categoryId !== params.get('categoryId')) return false;
    if (params.get('brandId') && product?.brandId !== params.get('brandId')) return false;
    if (warehouseProducts && !warehouseProducts.has(productId)) return false;
    return true;
  };
  let events = filter('customerFunnelEvents', (row) => row.sellerId === sellerId && row.date >= period.from && row.date <= period.to && productAllowed(row.productId));
  if (params.get('sku')) events = events.filter((row) => row.sku === params.get('sku'));
  let items = filter('orderItems', (row) => row.sellerId === sellerId && productAllowed(row.productId)).filter((row) => { const date = findById('orders', row.orderId)?.placedAt?.slice(0, 10); return date >= period.from && date <= period.to; });
  if (params.get('fulfillmentType')) items = items.filter((row) => row.fulfillmentType === params.get('fulfillmentType'));
  if (params.get('sku')) items = items.filter((row) => findById('variants', row.variantId)?.sku === params.get('sku'));
  if (warehouseSkus) items = items.filter((row) => warehouseSkus.has(findById('variants', row.variantId)?.sku));
  const itemIds = new Set(items.map((row) => row.id));
  const settlements = filter('settlementLines', (row) => row.sellerId === sellerId && itemIds.has(row.orderItemId));
  return { period, events, items, settlements, productAllowed, warehouseInventory };
}

function base(view, period) {
  return { view, period, freshnessAt: mockNowIso(), definitions: { attributedRevenue: 'GMV from orders attributed to an ad click within the platform attribution window.', lostSales: 'Estimated product views that could not convert while the listing had no available stock.', netEarnings: 'Settlement sale amount less commission, fulfilment fees, tax and applied adjustments.', conversion: 'Orders divided by product views for the selected period.' } };
}

export function analyticsView(sellerId, view, params) {
  const { period, events, items, settlements, warehouseInventory } = scoped(sellerId, params);
  const orders = new Set(items.map((row) => row.orderId));
  const gmvPaise = sum(items.filter((row) => row.status !== 'CANCELLED'), 'linePaise');
  const funnel = [{ key: 'impressions', label: 'Impressions', value: sum(events, 'impressions') }, { key: 'productViews', label: 'Product views', value: sum(events, 'productViews') }, { key: 'addsToCart', label: 'Add to cart', value: sum(events, 'addsToCart') }, { key: 'checkouts', label: 'Checkout', value: sum(events, 'checkouts') }, { key: 'orders', label: 'Orders', value: orders.size }];
  const dates = [...new Set(events.map((row) => row.date))].sort();
  const series = dates.map((date) => { const day = events.filter((row) => row.date === date); return { date, impressions: sum(day, 'impressions'), productViews: sum(day, 'productViews'), addsToCart: sum(day, 'addsToCart'), checkouts: sum(day, 'checkouts') }; });
  if (view === 'overview') {
    const orderRows = [...orders].map((orderId) => findById('orders', orderId)).filter(Boolean);
    const breakdown = (keyFn) => Object.entries(events.reduce((acc, row) => ({ ...acc, [keyFn(row)]: (acc[keyFn(row)] ?? 0) + row.productViews }), {})).map(([label, value]) => ({ label, value }));
    return { ...base(view, period), funnel, series, kpis: { gmvPaise, orders: orders.size, units: items.reduce((total, row) => total + (row.qty ?? 1), 0), aspPaise: items.length ? Math.round(gmvPaise / items.length) : 0, discountPaise: orderRows.reduce((total, row) => total + (row.priceDetails?.discountPaise ?? 0), 0), cancellations: items.filter((row) => row.status === 'CANCELLED').length, returns: filter('returns', (row) => itemIds(items).has(row.orderItemId)).length, netEarningsPaise: sum(settlements, 'netPaise') }, breakdowns: { channel: breakdown((row) => row.source), category: breakdown((row) => findById('categories', findById('products', row.productId)?.categoryId)?.name ?? 'Other'), geography: Object.entries(orderRows.reduce((acc, row) => ({ ...acc, [row.address?.state ?? 'Unknown']: (acc[row.address?.state ?? 'Unknown'] ?? 0) + 1 }), {})).map(([label, value]) => ({ label, value })) }, comparison: period.compare ? { gmvPct: -3.4, ordersPct: 2.1, conversionPct: 0.8 } : null };
  }
  if (view === 'products') {
    const offers = filter('offers', (row) => row.sellerId === sellerId);
    const rows = offers.map((offer) => { const productId = offer.productId ?? findById('variants', offer.variantId)?.productId; const product = findById('products', productId); const e = events.filter((row) => row.offerId === offer.id); const sold = items.filter((row) => row.productId === productId); const settlement = settlements.filter((row) => sold.some((item) => item.id === row.orderItemId)); const views = sum(e, 'productViews'); return { id: offer.id, listingId: offer.id, productId, productTitle: product?.title, sku: offer.sku, impressions: sum(e, 'impressions'), productViews: views, orders: new Set(sold.map((row) => row.orderId)).size, conversionPct: pct(new Set(sold.map((row) => row.orderId)).size, views), gmvPaise: sum(sold, 'linePaise'), netEarningsPaise: sum(settlement, 'netPaise'), buyBoxSharePct: offer.buyBoxWinner ? 100 : 0, lostSalesPaise: offer.stock > 0 ? 0 : Math.round(views * (offer.sellingPricePaise ?? 0) * 0.03), remediationPath: `/listings/${offer.id}` }; });
    return { ...base(view, period), rows };
  }
  if (view === 'traffic') {
    const sources = ['SEARCH', 'CATEGORY', 'ADS'].map((source) => { const rows = events.filter((row) => row.source === source); return { key: source, label: source, impressions: sum(rows, 'impressions'), productViews: sum(rows, 'productViews') }; });
    const adCampaignIds = new Set(filter('adCampaigns', (row) => row.sellerId === sellerId).map((row) => row.id));
    const ads = filter('adDailyStats', (row) => adCampaignIds.has(row.campaignId) && row.date >= period.from && row.date <= period.to);
    return { ...base(view, period), funnel, series, sources, ads: { impressions: sum(ads, 'impressions'), clicks: sum(ads, 'clicks'), spendPaise: sum(ads, 'spendPaise'), attributedRevenuePaise: sum(ads, 'adGmvPaise'), orders: sum(ads, 'adOrders'), ctrPct: pct(sum(ads, 'clicks'), sum(ads, 'impressions')), cpcPaise: sum(ads, 'clicks') ? Math.round(sum(ads, 'spendPaise') / sum(ads, 'clicks')) : 0, conversionPct: pct(sum(ads, 'adOrders'), sum(ads, 'clicks')), roas: sum(ads, 'spendPaise') ? Number((sum(ads, 'adGmvPaise') / sum(ads, 'spendPaise')).toFixed(2)) : 0 } };
  }
  if (view === 'operations') {
    const shipments = filter('shipments', (row) => row.sellerId === sellerId && items.some((item) => item.orderId === row.orderId));
    const returns = filter('returns', (row) => row.sellerId === sellerId && itemIds(items).has(row.orderItemId));
    return { ...base(view, period), kpis: { dispatchSlaPct: pct(shipments.filter((row) => !['PLACED', 'ACCEPTED'].includes(row.status)).length, shipments.length), ndr: filter('ndrRecords', (row) => shipments.some((shipment) => shipment.id === row.shipmentId)).length, rto: shipments.filter((row) => String(row.status).includes('RTO')).length, returns: returns.length }, returnReasons: Object.entries(returns.reduce((acc, row) => ({ ...acc, [row.reason]: (acc[row.reason] ?? 0) + 1 }), {})).map(([label, value]) => ({ label, value })), inventoryAgeing: (warehouseInventory ?? filter('inventory', (row) => row.sellerId === sellerId)).map((row) => ({ sku: row.sku, productTitle: row.productTitle, available: row.sellable - row.reserved, ageDays: row.oldestUnitDays ?? 30, warehouseId: row.warehouseId })) };
  }
  return { ...base('finance', period), kpis: { grossPaise: sum(settlements, 'salePaise'), feesPaise: sum(settlements, 'feesBeforeTaxPaise') + sum(settlements, 'gstOnFeesPaise'), taxPaise: sum(settlements, 'tcsPaise') + sum(settlements, 'tdsPaise'), adjustmentsPaise: sum(settlements, 'adjustmentsPaise'), netEarningsPaise: sum(settlements, 'netPaise') }, rows: settlements };
}

function itemIds(items) { return new Set(items.map((row) => row.id)); }

export function analyticsFilters(sellerId) {
  const offers = filter('offers', (row) => row.sellerId === sellerId);
  const products = offers.map((offer) => findById('products', offer.productId ?? findById('variants', offer.variantId)?.productId)).filter(Boolean);
  return { timezones: ['Asia/Kolkata', 'UTC'], warehouses: filter('warehouses', (row) => row.sellerId === sellerId || filter('inventory', (item) => item.sellerId === sellerId && item.warehouseId === row.id).length).map((row) => ({ value: row.id, label: row.name })), categories: [...new Map(products.map((row) => [row.categoryId, findById('categories', row.categoryId)?.name])).entries()].map(([value, label]) => ({ value, label })), brands: [...new Map(products.map((row) => [row.brandId, findById('brands', row.brandId)?.name])).entries()].map(([value, label]) => ({ value, label })), skus: offers.map((row) => ({ value: row.sku, label: row.sku })), fulfillmentTypes: ['SELLER', 'ARISE'] };
}
