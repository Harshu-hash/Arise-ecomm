// Dashboards and analytics (admin and seller) over seeded orders, returns, settlement and stock. Needs TEST_MONGODB_URI.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { after, before } from 'node:test';
import mongoose from 'mongoose';

Object.assign(process.env, {
  NODE_ENV: 'test',
  DISABLE_INFRASTRUCTURE: 'true',
  JWT_ACCESS_SECRET: 'a'.repeat(48),
  JWT_REFRESH_SECRET: 'b'.repeat(48),
  DATA_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
  UPLOAD_DIR: mkdtempSync(join(tmpdir(), 'arise-analytics-')),
});
process.on('exit', () => rmSync(process.env.UPLOAD_DIR, { recursive: true, force: true }));

const uri = process.env.TEST_MONGODB_URI;
const opts = { skip: !uri && 'set TEST_MONGODB_URI to run' };
before(async () => { if (uri) await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000, autoIndex: true }); });
after(async () => {
  if (uri) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});

test('dashboards and analytics: real numbers for the admin and for one seller', opts, async (t) => {
  const { createApp } = await import('../src/app/app.js');
  const { signAccessToken } = await import('../src/shared/utils/jwt.js');
  const { User, Seller } = await import('../src/modules/identity/public/index.js');
  const { Order, Return } = await import('../src/modules/order/public/index.js');
  const { Product, Offer } = await import('../src/modules/product/public/index.js');
  const { SettlementLine, SellerWallet } = await import('../src/modules/settlement/public/index.js');
  await Promise.all([User.init(), Order.init(), Return.init(), SettlementLine.init()]);

  const server = createServer(createApp()).listen(0);
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const call = async (token, path) => {
    const response = await fetch(`${base}${path}`, { headers: token ? { authorization: `Bearer ${token}` } : {} });
    return { status: response.status, body: await response.json() };
  };
  const oid = () => new mongoose.Types.ObjectId();

  const admin = await User.create({ role: 'ADMIN', email: 'a@arise.test', passwordHash: 'x', status: 'ACTIVE', permissions: ['*'] });
  const limited = await User.create({ role: 'ADMIN', email: 'l@arise.test', passwordHash: 'x', status: 'ACTIVE', permissions: ['dashboard.dashboard.view'] });
  const asAdmin = (path) => call(signAccessToken({ sub: String(admin._id), role: 'ADMIN' }), path);
  const asLimited = (path) => call(signAccessToken({ sub: String(limited._id), role: 'ADMIN' }), path);

  const [shopA, shopB] = await Promise.all([Seller.create({ storeName: 'Nova', status: 'ACTIVE' }), Seller.create({ storeName: 'Other', status: 'UNDER_REVIEW' })]);
  const sellerId = String(shopA._id);
  const asSeller = (path) => call(signAccessToken({ sub: String(oid()), role: 'SELLER', sellerId }), path);
  await User.create({ role: 'CUSTOMER', name: 'Asha', email: 'asha@arise.test', passwordHash: 'x', status: 'ACTIVE' });

  const productId = oid();
  const category = 'Shirts';
  await Product.create({ _id: productId, title: 'Linen Shirt', categoryId: oid(), rootCategoryId: oid(), categoryPath: `Fashion › ${category}`, status: 'LIVE', createdBySellerId: sellerId });
  await Product.create({ title: 'Waiting', categoryId: oid(), rootCategoryId: oid(), status: 'QC_PENDING', createdBySellerId: sellerId });
  const offer = await Offer.create({ productId, variantId: oid(), sellerId, sellingPricePaise: 50_000, mrpPaise: 60_000, stock: 5, reserved: 5, status: 'LIVE', productTitle: 'Linen Shirt', sku: 'SKU-1', brandName: 'Nova', categoryPath: `Fashion › ${category}` });

  const item = (amountPaise, quantity = 1) => ({ _id: oid(), offerId: offer._id, productId: String(productId), name: 'Linen Shirt', brand: 'Nova', category, quantity, unitPricePaise: amountPaise / quantity, amountPaise, discountPaise: 0 });
  const now = new Date();
  const hoursAgo = (h) => new Date(now - h * 3_600_000);
  const parcel = (status, items, extra = {}) => ({ _id: oid(), sellerId, sellerName: 'Nova', status, items, itemsPaise: items.reduce((n, i) => n + i.amountPaise, 0), payablePaise: 0, events: [{ status: 'CONFIRMED', at: hoursAgo(60) }], ...extra });
  const order = (number, subOrders, extra = {}) => Order.create({
    number, customerId: 'c1', checkoutSessionId: oid(), paymentId: oid(), paymentMethod: 'upi', address: { city: 'Pune', state: 'Maharashtra' },
    totals: { subtotalPaise: subOrders.reduce((n, s) => n + s.itemsPaise, 0), couponDiscountPaise: extra.couponCode ? 5_000 : 0 }, subOrders, placedAt: hoursAgo(30), ...extra,
  });
  const delivered = item(100_000, 2);
  await order('O1', [parcel('DELIVERED', [delivered], { events: [{ status: 'CONFIRMED', at: hoursAgo(60) }, { status: 'READY_TO_SHIP', at: hoursAgo(55) }] })], { couponCode: 'SAVE5' });
  await order('O2', [parcel('CANCELLED', [item(40_000)])], { status: 'CANCELLED' });
  await order('O3', [parcel('CONFIRMED', [item(20_000)], { events: [{ status: 'CONFIRMED', at: hoursAgo(40) }] })]);
  await Return.create({
    number: 'R1', orderId: oid(), subOrderId: oid(), itemId: delivered._id, orderNumber: 'O1', productName: 'Linen Shirt', customerId: 'c1', sellerId, sellerName: 'Nova',
    reasonCode: 'SIZE', faultAttribution: 'CUSTOMER', pickupAddress: {}, amountPaise: 50_000, decisionDueAt: now, status: 'RECEIVED',
  });
  await SettlementLine.create({ key: 'l1', orderId: oid(), orderNumber: 'O1', subOrderId: oid(), orderItemId: delivered._id, sellerId, sellerName: 'Nova', deliveredAt: now, releaseAt: now, qty: 2, salePaise: 100_000, commissionPaise: 10_000, feesBeforeTaxPaise: 2_000, netPaise: 86_000 });
  await SellerWallet.create({ _id: sellerId, pendingPaise: 30_000, availablePaise: 56_000 });

  // ---- admin dashboard
  assert.equal((await call(null, '/admin/v1/dashboard/summary')).status, 401);
  const summary = (await asAdmin('/admin/v1/dashboard/summary?days=7')).body.data;
  const kpi = (key) => summary.kpis.find((k) => k.key === key);
  assert.equal(kpi('gmv').valuePaise, 120_000, 'cancelled parcels are not sales');
  assert.equal(kpi('orders').value, 2);
  assert.equal(kpi('units').value, 3);
  assert.equal(kpi('cancellationPct').value, 33.33);
  assert.equal(kpi('newCustomers').value, 1);
  assert.equal(kpi('netRevenue').valuePaise, 12_000, 'commission plus fees');
  assert.equal(kpi('activeSellers').value, 1);
  assert.equal(kpi('liveListings').value, 1);
  assert.equal(summary.series.length, 7);
  assert.equal(summary.series.reduce((n, d) => n + d.gmvPaise, 0), 120_000);
  assert.equal(summary.topProducts[0].label, 'Linen Shirt');
  assert.deepEqual(summary.topStates, [{ state: 'Maharashtra', orders: 2, gmvPaise: 120_000 }]);
  assert.deepEqual(summary.funnel.map((s) => s.count), [3, 1, 1, 1, 1]);
  const limitedSummary = (await asLimited('/admin/v1/dashboard/summary')).body.data;
  assert.equal(limitedSummary.kpis.find((k) => k.key === 'netRevenue'), undefined, 'finance figures need the finance widget permission');
  assert.deepEqual((await asLimited('/admin/v1/dashboard/action-center')).status, 403);

  const tiles = (await asAdmin('/admin/v1/dashboard/action-center')).body.data;
  const tile = (key) => tiles.find((entry) => entry.key === key);
  assert.equal(tile('listingsInQc').count, 1);
  assert.equal(tile('sellerApplicationsPending').count, 1);
  assert.equal(tile('returnsAwaitingQc').count, 1);
  assert.equal(tile('ordersNotAccepted').count, 1);
  assert.equal(tile('ordersNotAccepted').urgent, true);
  assert.deepEqual((await asAdmin('/admin/v1/dashboard/alerts')).body, { data: [], meta: { unread: 0 } });
  const money = (await asAdmin('/admin/v1/finance/overview')).body.data;
  assert.deepEqual([money.payableNowPaise, money.heldPaise, money.commissionPaise], [56_000, 30_000, 10_000]);

  // ---- admin analytics domains
  const sales = (await asAdmin('/admin/v1/reports/analytics/sales?days=30')).body.data;
  assert.deepEqual([sales.totals.gmvPaise, sales.totals.orders, sales.totals.units, sales.totals.aovPaise], [120_000, 2, 3, 60_000]);
  assert.equal(sales.byCategory[0].label, 'Shirts');
  assert.equal(sales.byCity[0].label, 'Pune');
  assert.equal((await asAdmin('/admin/v1/reports/analytics/customers')).body.data.totals.totalCustomers, 1);
  const catalog = (await asAdmin('/admin/v1/reports/analytics/catalog')).body.data;
  assert.deepEqual([catalog.totals.liveListings, catalog.totals.qcQueueSize, catalog.totals.outOfStockPct], [1, 1, 100]);
  assert.equal((await asAdmin('/admin/v1/reports/analytics/sellers')).body.data.totals.activeSellers, 1);
  const returns = (await asAdmin('/admin/v1/reports/analytics/returns')).body.data;
  assert.deepEqual([returns.totals.totalReturns, returns.byReason[0].label], [1, 'SIZE']);
  const finance = (await asAdmin('/admin/v1/reports/analytics/finance')).body.data.totals;
  assert.deepEqual([finance.commissionPaise, finance.netRevenuePaise], [10_000, 12_000]);
  assert.equal((await asAdmin('/admin/v1/reports/analytics/marketing')).body.data.totals.couponRedemptions, 1);
  assert.equal((await asAdmin('/admin/v1/reports/analytics/support')).body.data.notBuilt, true);
  for (const domain of ['fulfilment']) assert.equal((await asAdmin(`/admin/v1/reports/analytics/${domain}`)).status, 200);
  assert.equal((await asAdmin('/admin/v1/reports/analytics/nonsense')).status, 404);
  assert.equal((await asLimited('/admin/v1/reports/analytics/finance')).status, 403);

  // ---- seller dashboard and analytics: only this seller's numbers
  const mine = (await asSeller('/seller/v1/dashboard/summary')).body.data;
  assert.equal(mine.store.name, 'Nova');
  assert.deepEqual([mine.kpis.gmv30dPaise, mine.kpis.orders30d, mine.kpis.liveListings, mine.kpis.ordersToProcess, mine.kpis.returnsPending, mine.kpis.payoutDuePaise], [120_000, 2, 1, 1, 1, 56_000]);
  assert.equal(mine.accountHealth.cancellationPct, 33.33);
  assert.equal(mine.accountHealth.lateDispatchPct, 0, 'dispatched inside two days');
  const otherSeller = (await call(signAccessToken({ sub: String(oid()), role: 'SELLER', sellerId: String(shopB._id) }), '/seller/v1/dashboard/summary')).body.data;
  assert.deepEqual([otherSeller.kpis.gmv30dPaise, otherSeller.kpis.orders30d], [0, 0]);
  assert.equal((await call(signAccessToken({ sub: String(oid()), role: 'CUSTOMER' }), '/seller/v1/dashboard/summary')).status, 403);
  const activity = (await asSeller('/seller/v1/dashboard/activity')).body.data;
  assert.ok(activity.length >= 3 && activity[0].title.startsWith('Order O'));

  const overview = (await asSeller('/seller/v1/analytics/overview?compare=true')).body.data;
  assert.deepEqual([overview.kpis.gmvPaise, overview.kpis.orders, overview.kpis.units, overview.kpis.aspPaise, overview.kpis.cancellations, overview.kpis.returns, overview.kpis.netEarningsPaise], [120_000, 2, 3, 40_000, 1, 1, 86_000]);
  assert.equal(overview.salesSeries.length, 30);
  assert.equal(overview.salesBreakdowns.category[0].label, 'Shirts');
  assert.equal(overview.breakdowns.geography[0].label, 'Maharashtra');
  assert.ok(overview.comparison, 'compare asked for');
  assert.equal((await asSeller(`/seller/v1/analytics/overview?categoryId=Shoes`)).body.data.kpis.gmvPaise, 0, 'filters narrow the numbers');
  assert.equal((await asSeller(`/seller/v1/analytics/overview?sku=SKU-1`)).body.data.kpis.gmvPaise, 120_000);
  const products = (await asSeller('/seller/v1/analytics/products')).body.data.rows;
  assert.deepEqual([products[0].sku, products[0].orders, products[0].gmvPaise, products[0].netEarningsPaise], ['SKU-1', 2, 120_000, 86_000]);
  const ops = (await asSeller('/seller/v1/analytics/operations')).body.data;
  assert.deepEqual([ops.kpis.dispatchSlaPct, ops.kpis.returns, ops.returnReasons[0].label], [100, 1, 'SIZE']);
  assert.equal(ops.inventoryAgeing[0].available, 0);
  const sellerFinance = (await asSeller('/seller/v1/analytics/finance')).body.data;
  assert.deepEqual([sellerFinance.kpis.grossPaise, sellerFinance.kpis.feesPaise, sellerFinance.kpis.netEarningsPaise, sellerFinance.rows.length], [100_000, 2_000, 86_000, 1]);
  assert.equal((await asSeller('/seller/v1/analytics/traffic')).body.data.ads.spendPaise, 0);
  const filters = (await asSeller('/seller/v1/analytics/filters')).body.data;
  assert.deepEqual([filters.categories[0].value, filters.brands[0].value, filters.skus[0].value], ['Shirts', 'Nova', 'SKU-1']);
  assert.equal((await asSeller('/seller/v1/analytics/recommendations')).body.data.length, 0);
  assert.equal((await asSeller('/seller/v1/analytics/nonsense')).status, 422);
});
