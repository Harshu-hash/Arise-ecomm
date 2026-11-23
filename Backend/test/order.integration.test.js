// Real-MongoDB test of the whole money path: cart -> checkout -> payment -> order -> cancel.
// Needs TEST_MONGODB_URI to a replica set (checkout and orders use transactions). Razorpay and Shiprocket are stubbed.
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
  UPLOAD_DIR: mkdtempSync(join(tmpdir(), 'arise-order-')),
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

test('orders: checkout prices per seller, pays once, places one order, and cancelling refunds and restocks', opts, async (t) => {
  const { createApp } = await import('../src/app/app.js');
  const { signAccessToken } = await import('../src/shared/utils/jwt.js');
  const { paymentGateway } = await import('../src/infrastructure/external/payment/index.js');
  const { shippingGateway } = await import('../src/infrastructure/external/shipping/index.js');
  const { processReceipt } = await import('../src/infrastructure/webhooks/webhookProcessor.js');
  const { WebhookReceipt } = await import('../src/infrastructure/webhooks/webhookReceipt.model.js');
  const { Category } = await import('../src/modules/category/infrastructure/persistence/category.model.js');
  const { Product } = await import('../src/modules/product/infrastructure/persistence/product.model.js');
  const { Offer } = await import('../src/modules/product/infrastructure/persistence/offer.model.js');
  const { Variant } = await import('../src/modules/product/infrastructure/persistence/variant.model.js');
  const { Seller } = await import('../src/modules/identity/infrastructure/persistence/seller.model.js');
  const { AddressBook } = await import('../src/modules/customer/infrastructure/persistence/addressBook.model.js');
  const { Order } = await import('../src/modules/order/infrastructure/persistence/order.model.js');
  const { Invoice } = await import('../src/modules/order/infrastructure/persistence/invoice.model.js');
  const { CheckoutSession } = await import('../src/modules/order/infrastructure/persistence/checkoutSession.model.js');
  const { Payment } = await import('../src/modules/payment/infrastructure/persistence/payment.model.js');
  const { StockMovement } = await import('../src/modules/product/infrastructure/persistence/stockMovement.model.js');
  const { expireStaleReservations } = await import('../src/modules/product/public/index.js');
  const { catalogChanged } = await import('../src/infrastructure/realtime/catalogEvents.js');
  await Promise.all([Category.init(), Product.init(), Offer.init(), Variant.init(), Seller.init(), Order.init(), Payment.init(), CheckoutSession.init(), Invoice.init(), WebhookReceipt.init()]);

  // ---- stubs: Razorpay and Shiprocket
  const refunds = [];
  paymentGateway.createPayment = async ({ receipt }) => ({ providerOrderId: `order_${receipt}` });
  paymentGateway.verifyCheckout = ({ signature }) => signature === 'good';
  const refundKeys = [];
  paymentGateway.refund = async ({ providerPaymentId, amountPaise, idempotencyKey }) => { refundKeys.push(idempotencyKey); refunds.push({ providerPaymentId, amountPaise }); return { providerRefundId: `rfnd_${refunds.length}`, providerStatus: 'processed' }; };
  const { AppError } = await import('../src/shared/errors/AppError.js');
  const shiprocket = { calls: [], failNext: null };
  let awbCounter = 0;
  const step = (name, result) => async () => {
    shiprocket.calls.push(name);
    if (shiprocket.failNext === name) {
      shiprocket.failNext = null;
      throw new AppError({ code: 'SHIPPING_PROVIDER_ERROR', status: 502, message: 'Shiprocket could not assign a courier: wallet balance is low', retryable: true });
    }
    return result();
  };
  shippingGateway.ensurePickupLocation = step('ensurePickupLocation', () => undefined);
  shippingGateway.createShipment = step('createShipment', () => ({ shiprocketOrderId: 'SR1', shipmentId: '5001' }));
  shippingGateway.assignAwb = step('assignAwb', () => ({ awb: `AWB${++awbCounter}`, courierName: 'BlueDart' }));
  shippingGateway.generateLabel = step('generateLabel', () => ({ labelUrl: 'https://labels.test/1.pdf' }));
  shippingGateway.requestPickup = step('requestPickup', () => undefined);
  shippingGateway.cancelShipment = step('cancelShipment', () => undefined);
  shippingGateway.createReturnShipment = step('createReturnShipment', () => ({ shiprocketOrderId: 'SRR1', shipmentId: '6001' }));
  const { fcm } = await import('../src/infrastructure/external/notification/fcm.js');
  const pushes = [];
  fcm.configured = () => true;
  fcm.send = async ({ token, title, body, data }) => {
    pushes.push({ token, title, body, data });
    return token === 'dead-token-0000' ? { sent: false, invalidToken: true } : { sent: true };
  };
  shippingGateway.quote = async ({ pickupPincode }) => ({ serviceable: true, feePaise: pickupPincode === '380015' ? 5_000 : 7_000, etaDays: 3 });

  // ---- data: one category (GST 12%, commission 10%), two sellers, three offers
  const rootId = new mongoose.Types.ObjectId();
  await Category.create({ _id: rootId, name: 'Ord Root', nameKey: 'ord root', slug: 'ord-root', parentId: null, rootId, level: 1, sortOrder: 1, gstRate: 12, hsnCode: '6109', commissionPct: 10 });
  const { User } = await import('../src/modules/identity/infrastructure/persistence/user.model.js');
  let sellerNo = 0;
  const seller = async (storeName, pincode) => {
    const created = await Seller.create({ storeName, status: 'APPROVED', location: { pincode, address: '1 Warehouse Road', city: 'Ahmedabad', state: 'Gujarat' } });
    sellerNo += 1;
    await User.create({ role: 'SELLER', sellerId: String(created._id), email: `owner${sellerNo}@seller.test`, phone: `98000000${sellerNo}0`, name: `Owner ${sellerNo}` });
    return String(created._id);
  };
  const sellerA = await seller('Ord A', '380015');
  const sellerB = await seller('Ord B', '110001');
  const listed = async (title, sellerId, stock, sellingPricePaise) => {
    const product = await Product.create({ title, status: 'LIVE', categoryId: rootId, rootCategoryId: rootId, categoryPath: 'Ord Root', brandName: 'Acme', images: ['public/products/s1/o.png'], createdBySellerId: sellerId });
    const variant = await Variant.create({ productId: product._id, sku: title.toUpperCase().replaceAll(' ', '-'), label: 'One', weightG: 400, dimsCm: { l: 1, w: 1, h: 1 } });
    const offer = await Offer.create({ productId: product._id, variantId: variant._id, sellerId, sellingPricePaise, mrpPaise: sellingPricePaise + 2_000, stock, status: 'LIVE' });
    catalogChanged();
    return String(offer._id);
  };
  const mug = await listed('Ord Mug', sellerA, 5, 11_200);
  const lamp = await listed('Ord Lamp', sellerB, 3, 22_400);

  const alice = String(new mongoose.Types.ObjectId());
  await User.create({ _id: alice, role: 'CUSTOMER', email: 'alice@customer.test', name: 'Alice Rao' });
  await AddressBook.create({ customerId: alice, addresses: [{ label: 'Home', isDefault: true, name: 'Alice Rao', phone: '9876543210', line: '12 Test Street', city: 'Ahmedabad', state: 'Gujarat', pincode: '380015' }] });

  const server = createServer(createApp());
  const { createSocketServer, closeSocketServer } = await import('../src/infrastructure/realtime/socket.js');
  createSocketServer(server);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    await closeSocketServer();
    await new Promise((resolve) => server.close(resolve));
  });
  let keys = 0;
  const call = async (method, path, body) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/customer/v1${path}`, {
      method,
      headers: { 'content-type': 'application/json', 'idempotency-key': `test-key-${++keys}-${Date.now()}`, authorization: `Bearer ${signAccessToken({ sub: alice, role: 'CUSTOMER' })}` },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: await response.json() };
  };
  const stockOf = async (offerId) => { const o = await Offer.findById(offerId).lean(); return [o.stock, o.reserved ?? 0]; };
  const capture = async (payment, id = `pay_${randomBytes(4).toString('hex')}`) => {
    const receipt = await WebhookReceipt.create({
      provider: 'RAZORPAY', providerEventId: `evt_${id}`, eventType: 'payment.captured',
      payload: { event: 'payment.captured', payload: { payment: { entity: { id, order_id: payment.providerOrderId, amount: payment.amountPaise, currency: 'INR', status: 'captured', method: 'upi' } } } },
    });
    return processReceipt(receipt._id);
  };

  // ---- phones: one live, one whose token Firebase will reject
  assert.deepEqual((await call('POST', '/devices/push-tokens', { deviceId: 'phone-1', token: 'token-alice-1234', platform: 'android' })).body.data, { registered: true, deviceId: 'phone-1' });
  assert.equal((await call('POST', '/devices/push-tokens', { deviceId: 'phone-2', token: 'dead-token-0000', platform: 'ios' })).status, 200);
  assert.equal((await call('POST', '/devices/push-tokens', { deviceId: 'phone-3', token: 'x' })).status, 422);

  // ---- checkout from a cart with two sellers
  assert.equal((await call('POST', '/cart/items', { offerId: mug, quantity: 2 })).status, 201);
  assert.equal((await call('POST', '/cart/items', { offerId: lamp, quantity: 1 })).status, 201);
  const created = await call('POST', '/checkout/sessions', { source: 'CART' });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const session = created.body.data;
  assert.equal(session.status, 'READY');
  assert.equal(session.totals.subtotalPaise, 2 * 11_200 + 22_400);
  assert.equal(session.totals.deliveryFeePaise, 12_000); // one Shiprocket parcel per seller: 5000 + 7000
  assert.equal(session.totals.platformFeePaise, 500);
  assert.equal(session.totals.taxPaise, Math.round(22_400 * 12 / 112) + Math.round(22_400 * 12 / 112)); // GST is inside the price
  assert.equal(session.totals.payablePaise, 44_800 + 12_000 + 500);
  assert.equal(session.lines.length, 2);
  assert.deepEqual(await stockOf(mug), [5, 0]); // nothing is held until payment starts

  // a price change after the customer saw the total: nothing is charged or held, the app is told to review
  await Offer.updateOne({ _id: lamp }, { $set: { sellingPricePaise: 23_400 } });
  const changed = await call('POST', `/checkout/sessions/${session.id}/payment-intent`, { method: 'upi' });
  assert.deepEqual([changed.status, changed.body.error.code], [409, 'CHECKOUT_CHANGED']);
  assert.deepEqual(await stockOf(lamp), [3, 0]);
  const refreshed = (await call('POST', `/checkout/sessions/${session.id}/revalidate`)).body.data;
  assert.equal(refreshed.totals.payablePaise, session.totals.payablePaise + 1_000);

  // paying: stock is held, a retry reuses the same payment
  assert.equal((await call('PATCH', `/checkout/sessions/${session.id}/payment-method`, { paymentMethod: 'upi' })).status, 200);
  const intent = await call('POST', `/checkout/sessions/${session.id}/payment-intent`, { method: 'upi' });
  assert.equal(intent.status, 201, JSON.stringify(intent.body));
  assert.equal(intent.body.data.status, 'REQUIRES_ACTION');
  assert.equal(intent.body.data.providerAction.type, 'SDK');
  assert.equal(intent.body.data.providerAction.sdk.orderId, `order_${session.id}`);
  assert.deepEqual([await stockOf(mug), await stockOf(lamp)], [[5, 2], [3, 1]]);
  const again = await call('POST', `/checkout/sessions/${session.id}/payment-intent`, { method: 'upi' });
  assert.equal(again.body.data.id, intent.body.data.id);

  // an order cannot be placed, and a forged confirmation is refused, until it is really paid
  const paymentId = intent.body.data.id;
  assert.equal((await call('POST', '/orders', { checkoutSessionId: session.id, paymentId })).body.error.code, 'PAYMENT_NOT_COMPLETED');
  assert.equal((await call('POST', `/payments/${paymentId}/confirm`, { razorpayPaymentId: 'pay_x', razorpayOrderId: `order_${session.id}`, razorpaySignature: 'forged' })).status, 422);
  // the frozen quote: a paid checkout cannot be re-priced
  const payment = await Payment.findById(paymentId);
  const confirmed = await call('POST', `/payments/${paymentId}/confirm`, { razorpayPaymentId: 'pay_ok1', razorpayOrderId: payment.providerOrderId, razorpaySignature: 'good' });
  assert.equal(confirmed.body.data.status, 'SUCCEEDED');
  assert.equal((await call('POST', `/checkout/sessions/${session.id}/revalidate`)).body.error.code, 'CHECKOUT_PAID');

  const placed = await call('POST', '/orders', { checkoutSessionId: session.id, paymentId });
  assert.equal(placed.status, 201, JSON.stringify(placed.body));
  const order = placed.body.data;
  assert.deepEqual([order.status, order.paymentStatus, order.canCancel, order.items.length, order.amountPaise], ['CONFIRMED', 'PAID', true, 2, refreshed.totals.payablePaise]);
  assert.deepEqual([await stockOf(mug), await stockOf(lamp)], [[3, 0], [2, 0]]); // sold: stock gone, hold gone
  assert.equal((await call('GET', '/cart')).body.data.items.length, 0);
  const stored = await Order.findById(order.id).lean();
  assert.equal(stored.subOrders.length, 2);
  const mugLine = stored.subOrders.find((sub) => sub.sellerId === sellerA).items[0];
  assert.deepEqual([mugLine.gstRate, mugLine.commissionPct, mugLine.commissionPaise], [12, 10, 2_240]);

  // placing again, from the app or from Razorpay's webhook, returns the same order
  assert.equal((await call('POST', '/orders', { checkoutSessionId: session.id, paymentId })).body.data.id, order.id);
  await capture(payment, 'pay_ok1');
  assert.equal(await Order.countDocuments({ customerId: alice }), 1);
  assert.equal((await call('GET', '/orders')).body.data.total, 1);
  assert.equal((await call('GET', `/orders/${order.id}/timeline`)).body.data.items[0].completed, true);

  // cancelling before shipment: stock back with a ledger line, whole payment refunded, repeating is harmless
  const cancelled = await call('POST', `/orders/${order.id}/cancel`, { reason: 'Changed my mind' });
  assert.deepEqual([cancelled.body.data.status, cancelled.body.data.paymentStatus, cancelled.body.data.canCancel], ['CANCELLED', 'REFUNDED', false]);
  assert.deepEqual([await stockOf(mug), await stockOf(lamp)], [[5, 0], [3, 0]]);
  assert.deepEqual(refunds, [{ providerPaymentId: 'pay_ok1', amountPaise: refreshed.totals.payablePaise }]);
  assert.equal(await StockMovement.countDocuments({ type: 'CANCELLATION' }), 2);
  assert.equal((await call('POST', `/orders/${order.id}/cancel`, {})).body.data.status, 'CANCELLED');
  assert.equal(refunds.length, 1);

  // a customer who pays via the webhook only (app closed) still gets their order
  await call('POST', '/cart/items', { offerId: mug, quantity: 1 });
  const second = (await call('POST', '/checkout/sessions', { source: 'CART' })).body.data;
  const secondPayment = (await call('POST', `/checkout/sessions/${second.id}/payment-intent`, { method: 'card' })).body.data;
  await capture(await Payment.findById(secondPayment.id));
  assert.equal(await Order.countDocuments({ checkoutSessionId: second.id }), 1);

  // paying after the window ran out and the stock was given away: refunded, no order
  await call('POST', '/cart/items', { offerId: lamp, quantity: 1 });
  const late = (await call('POST', '/checkout/sessions', { source: 'CART' })).body.data;
  const latePayment = (await call('POST', `/checkout/sessions/${late.id}/payment-intent`, { method: 'upi' })).body.data;
  await mongoose.connection.collection('stock_reservations').updateMany({ reference: `checkout:${late.id}` }, { $set: { expiresAt: new Date(Date.now() - 1_000) } });
  assert.equal(await expireStaleReservations(), 1);
  const refundsBefore = refunds.length;
  await capture(await Payment.findById(latePayment.id));
  assert.equal(await Order.countDocuments({ checkoutSessionId: late.id }), 0);
  assert.equal(refunds.length, refundsBefore + 1);
  assert.equal((await CheckoutSession.findById(late.id)).status, 'EXPIRED');

  // coupons: a redemption is recorded with the order, limits use the customer's real history, cancelling gives it back
  const { Coupon } = await import('../src/modules/coupon/infrastructure/persistence/coupon.model.js');
  await Coupon.init();
  const day = 86_400_000;
  const coupon = (code, over) => Coupon.create({ code, name: code, type: 'FLAT', valuePaise: 5_000, minCartPaise: 0, totalLimit: 10, perUserLimit: 1, budgetPaise: 1_000_000, startsAt: new Date(Date.now() - day), endsAt: new Date(Date.now() + day), createdBy: 'admin', ...over });
  await coupon('ORD50', {});
  await coupon('ORDNEW', { audience: { type: 'NEW' } });
  const redemptions = async () => (await Coupon.findOne({ code: 'ORD50' }).lean()).totalRedemptions;
  await call('POST', '/cart/items', { offerId: mug, quantity: 1 });
  assert.equal((await call('POST', '/cart/coupon', { code: 'ORDNEW' })).status, 409); // she already has an order: not a first order
  assert.equal((await call('POST', '/cart/coupon', { code: 'ORD50' })).status, 200);
  const withCoupon = (await call('POST', '/checkout/sessions', { source: 'CART' })).body.data;
  assert.deepEqual([withCoupon.couponCode, withCoupon.totals.couponDiscountPaise], ['ORD50', 5_000]);
  const couponPayment = (await call('POST', `/checkout/sessions/${withCoupon.id}/payment-intent`, { method: 'upi' })).body.data;
  await capture(await Payment.findById(couponPayment.id));
  const couponOrder = await Order.findOne({ checkoutSessionId: withCoupon.id });
  assert.equal(couponOrder.couponCode, 'ORD50');
  assert.equal(await redemptions(), 1);
  await call('POST', '/cart/items', { offerId: mug, quantity: 1 });
  assert.equal((await call('POST', '/cart/coupon', { code: 'ORD50' })).status, 409); // one use per customer, and she has used it
  await call('POST', `/orders/${couponOrder._id}/cancel`, {});
  assert.equal(await redemptions(), 0);
  assert.equal((await call('POST', '/cart/coupon', { code: 'ORD50' })).status, 200); // given back with the cancelled order

  // ======================================================================= seller fulfilment (Shiprocket)
  const sellerCall = async (sellerId, method, path, body) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/seller/v1${path}`, {
      method,
      headers: { 'content-type': 'application/json', 'idempotency-key': `seller-key-${++keys}-${Date.now()}`, authorization: `Bearer ${signAccessToken({ sub: String(new mongoose.Types.ObjectId()), role: 'SELLER', sellerId })}` },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: await response.json() };
  };
  const track = async (awb, status, at) => {
    const receipt = await WebhookReceipt.create({
      provider: 'SHIPROCKET', providerEventId: `${awb}:${status}:${at}`, eventType: 'shipment.tracking',
      payload: { awb, current_status: status, current_status_id: status.length, current_timestamp: at },
    });
    return processReceipt(receipt._id);
  };
  const buyNow = async (items, method = 'upi') => {
    const checkout = (await call('POST', '/checkout/sessions', { source: 'BUY_NOW', items })).body.data;
    const intent = (await call('POST', `/checkout/sessions/${checkout.id}/payment-intent`, { method })).body.data;
    await capture(await Payment.findById(intent.id));
    return { checkout, order: await Order.findOne({ checkoutSessionId: checkout.id }) };
  };

  // one parcel, one seller: accept, ready to ship, the courier collects and delivers
  const single = await buyNow([{ offerId: mug, quantity: 1 }]);
  const parcelId = String(single.order.subOrders[0]._id);
  const newOrders = await sellerCall(sellerA, 'GET', '/orders?stage=NEW');
  assert.equal(newOrders.status, 200, JSON.stringify(newOrders.body));
  const newRow = newOrders.body.data.find((row) => row.id === parcelId);
  assert.deepEqual([newRow.nextAction, newRow.customerPhone], ['confirm', '••••••3210']);
  assert.equal((await sellerCall(sellerB, 'GET', `/orders/${parcelId}`)).status, 404); // another seller's parcel is invisible
  assert.equal((await sellerCall(sellerB, 'POST', `/orders/${parcelId}/confirm`)).status, 404);
  assert.equal((await sellerCall(sellerA, 'POST', `/orders/${parcelId}/ready-to-ship`)).body.error.code, 'ILLEGAL_TRANSITION'); // accept first

  const accepted = await sellerCall(sellerA, 'POST', `/orders/${parcelId}/confirm`);
  assert.deepEqual([accepted.body.data.status, accepted.body.data.nextAction], ['ACCEPTED', 'ready-to-ship']);
  assert.equal((await sellerCall(sellerA, 'POST', `/orders/${parcelId}/confirm`)).status, 200); // twice is harmless
  assert.equal((await call('GET', `/orders/${single.order._id}`)).body.data.status, 'PROCESSING');

  // a failing Shiprocket step stops it with Shiprocket's reason; clicking again resumes instead of starting over
  shiprocket.failNext = 'assignAwb';
  const failed = await sellerCall(sellerA, 'POST', `/orders/${parcelId}/ready-to-ship`);
  assert.deepEqual([failed.status, failed.body.error.code], [502, 'SHIPPING_PROVIDER_ERROR']);
  assert.equal((await sellerCall(sellerA, 'GET', `/orders/${parcelId}`)).body.data.status, 'ACCEPTED');
  const ready = await sellerCall(sellerA, 'POST', `/orders/${parcelId}/ready-to-ship`);
  assert.equal(ready.status, 200, JSON.stringify(ready.body));
  assert.deepEqual([ready.body.data.status, ready.body.data.awb, ready.body.data.courierName], ['READY_TO_SHIP', 'AWB1', 'BlueDart']);
  assert.equal((await sellerCall(sellerA, 'POST', `/orders/${parcelId}/ready-to-ship`)).status, 200);
  assert.deepEqual(shiprocket.calls.reduce((counts, name) => ({ ...counts, [name]: (counts[name] ?? 0) + 1 }), {}),
    { ensurePickupLocation: 1, createShipment: 1, assignAwb: 2, generateLabel: 1, requestPickup: 1 }); // created once, however many clicks
  assert.equal((await sellerCall(sellerA, 'GET', `/orders/${parcelId}`)).body.data.documents[0].type, 'SHIPPING_LABEL');

  // invoices: issued once at ready-to-ship (seller's goods invoice + Arise's platform-fee invoice), as a PDF, visible only to its owners
  const invoices = await Invoice.find({ orderId: single.order._id }).lean();
  assert.deepEqual(invoices.map((i) => i.kind).sort(), ['GOODS', 'PLATFORM_FEE']);
  const goods = invoices.find((i) => i.kind === 'GOODS');
  assert.equal(goods.totals.totalPaise, goods.totals.taxablePaise + goods.totals.cgstPaise + goods.totals.sgstPaise + goods.totals.igstPaise);
  assert.deepEqual([goods.taxable, goods.totals.cgstPaise + goods.totals.sgstPaise + goods.totals.igstPaise], [false, 0]); // seller A has no GSTIN: a bill of supply, no GST
  assert.equal(ready.body.data.invoiceNo, goods.number);
  const pdf = await fetch(`http://127.0.0.1:${server.address().port}/api/seller/v1/orders/${parcelId}/invoice`, { headers: { authorization: `Bearer ${signAccessToken({ sub: String(new mongoose.Types.ObjectId()), role: 'SELLER', sellerId: sellerA })}` } });
  assert.equal(pdf.headers.get('content-type'), 'application/pdf');
  assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0, 5).toString(), '%PDF-');
  assert.equal((await sellerCall(sellerB, 'GET', `/orders/${parcelId}/invoice`)).status, 404);
  assert.equal((await call('GET', `/orders/${single.order._id}/invoices`)).body.data.length, 2);
  assert.equal((await sellerCall(sellerA, 'GET', `/orders/${parcelId}`)).body.data.documents.find((d) => d.number === goods.number).type, 'BILL_OF_SUPPLY');

  // a handed-over order can no longer be cancelled, by the customer or the seller
  assert.equal((await call('POST', `/orders/${single.order._id}/cancel`, {})).body.error.code, 'ORDER_NOT_CANCELLABLE');
  assert.equal((await sellerCall(sellerA, 'POST', `/orders/${parcelId}/cancel`, { reason: 'x' })).status, 409);

  // courier progress arrives through Shiprocket's webhook, late and out of order
  assert.equal((await WebhookReceipt.countDocuments({ provider: 'SHIPROCKET' })), 0);
  await track('AWB1', 'PICKED UP', '20 11 2026 10:00:00');
  await track('AWB1', 'OUT FOR DELIVERY', '21 11 2026 08:00:00');
  await track('AWB1', 'IN TRANSIT', '20 11 2026 18:00:00'); // an old scan arriving late changes nothing
  assert.equal((await call('GET', `/orders/${single.order._id}`)).body.data.status, 'OUT_FOR_DELIVERY');
  await track('AWB1', 'DELIVERED', '21 11 2026 12:30:00');
  const delivered = (await call('GET', `/orders/${single.order._id}`)).body.data;
  assert.deepEqual([delivered.status, delivered.items[0].awb], ['DELIVERED', 'AWB1']);
  assert.deepEqual(delivered.timeline.map((step) => step.completed), [true, true, true, true, true, true]);
  const tracking = (await call('GET', `/shipments/${delivered.items[0].shipmentId}/tracking`)).body.data;
  assert.deepEqual([tracking.status, tracking.awb, tracking.events.map((event) => event.status)], ['DELIVERED', 'AWB1', ['READY_TO_SHIP', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED']]);
  assert.equal((await sellerCall(sellerA, 'GET', '/orders?stage=DELIVERED')).body.meta.counts.DELIVERED, 1);

  // two sellers in one order: one seller cancels their part, the customer is refunded exactly that part
  const duo = await buyNow([{ offerId: mug, quantity: 1 }, { offerId: lamp, quantity: 1 }]);
  const mugParcel = duo.order.subOrders.find((sub) => sub.sellerId === sellerA);
  const lampParcel = duo.order.subOrders.find((sub) => sub.sellerId === sellerB);
  const lampBefore = await stockOf(lamp);
  const refundsBeforeDuo = refunds.length;
  const partial = await sellerCall(sellerB, 'POST', `/orders/${lampParcel._id}/cancel`, { reason: 'Damaged stock' });
  assert.deepEqual([partial.status, partial.body.data.status], [200, 'CANCELLED']);
  assert.deepEqual((await stockOf(lamp))[0], lampBefore[0] + 1);
  assert.deepEqual(refunds.slice(refundsBeforeDuo).map((refund) => refund.amountPaise), [lampParcel.payablePaise]);
  const afterPartial = (await call('GET', `/orders/${duo.order._id}`)).body.data;
  assert.deepEqual([afterPartial.status, afterPartial.paymentStatus, afterPartial.canCancel], ['CONFIRMED', 'PAID', true]);
  assert.equal((await sellerCall(sellerB, 'POST', `/orders/${lampParcel._id}/cancel`, {})).status, 200); // again: nothing more to refund
  assert.equal(refunds.length, refundsBeforeDuo + 1);

  // the customer then cancels what is left: the rest of the payment, platform fee included, goes back
  const rest = await call('POST', `/orders/${duo.order._id}/cancel`, { reason: 'Changed my mind' });
  assert.deepEqual([rest.body.data.status, rest.body.data.paymentStatus], ['CANCELLED', 'REFUNDED']);
  assert.equal(refunds.slice(refundsBeforeDuo).reduce((sum, refund) => sum + refund.amountPaise, 0), duo.order.totals.payablePaise);
  assert.equal((await sellerCall(sellerA, 'GET', `/orders/${mugParcel._id}`)).body.data.status, 'CANCELLED');
  const sellerDuo = (await sellerCall(sellerA, 'GET', '/orders')).body;
  assert.ok(sellerDuo.meta.counts.CANCELLED >= 2);

  // ============================================================================== notifications
  const { Notification } = await import('../src/modules/notification/infrastructure/persistence/notification.model.js');
  const { Device } = await import('../src/modules/notification/infrastructure/persistence/device.model.js');
  const { notify } = await import('../src/modules/notification/public/index.js');
  await new Promise((resolve) => setTimeout(resolve, 300)); // pushes are sent in the background
  const titles = async () => (await call('GET', '/notifications?limit=50')).body.data.items.map((item) => item.title);
  const all = await titles();
  for (const title of ['Order confirmed', 'Ready to ship', 'Order shipped', 'Out for delivery', 'Delivered', 'Part of your order was cancelled', 'Order cancelled', 'We could not complete your order']) {
    assert.ok(all.includes(title), `missing "${title}" in ${all.join(' | ')}`);
  }
  // each event tells the customer once, even though its webhook was processed twice
  assert.equal(await Notification.countDocuments({ recipientType: 'CUSTOMER', recipientId: alice, deduplicationKey: `order-placed:${order.id}` }), 1);
  // the live phone got pushes pointing at the order; the dead token was dropped after Firebase refused it
  const deliveredPush = pushes.find((push) => push.title === 'Delivered' && push.token === 'token-alice-1234');
  assert.deepEqual([deliveredPush.data.targetType, deliveredPush.data.entityId], ['ORDER', String(single.order._id)]);
  assert.ok((await Device.findOne({ deviceId: 'phone-2' })).invalidAt);
  assert.equal((await Device.findOne({ deviceId: 'phone-1' })).invalidAt, null);

  // reading: paging, one read, all read
  const firstPage = (await call('GET', '/notifications?limit=2')).body.data;
  assert.equal(firstPage.items.length, 2);
  assert.ok(firstPage.nextCursor);
  assert.equal((await call('GET', `/notifications?limit=2&cursor=${firstPage.nextCursor}`)).body.data.items.length, 2);
  assert.ok(firstPage.unreadCount >= 8);
  const read = (await call('PUT', `/notifications/${firstPage.items[0].id}/read`)).body.data;
  assert.ok(read.readAt);
  assert.equal((await call('GET', '/notifications')).body.data.unreadCount, firstPage.unreadCount - 1);
  await call('PUT', '/notifications/read-all');
  assert.equal((await call('GET', '/notifications')).body.data.unreadCount, 0);
  assert.equal((await call('PUT', `/notifications/${new mongoose.Types.ObjectId()}/read`)).status, 404);

  // preferences: a category switched off stops its pushes but not its in-app message
  assert.equal((await call('GET', '/notifications/preferences')).body.data.delivery, true);
  assert.equal((await call('PATCH', '/notifications/preferences', { delivery: false })).body.data.delivery, false);
  assert.equal((await call('PATCH', '/notifications/preferences', {})).status, 422);
  const pushesBefore = pushes.length;
  await notify({ to: { type: 'CUSTOMER', id: alice }, category: 'DELIVERY', title: 'Pref test off', body: 'x', key: 'pref-1' });
  await new Promise((resolve) => setTimeout(resolve, 200));
  assert.equal(pushes.length, pushesBefore);
  assert.ok((await titles()).includes('Pref test off'));
  await call('PATCH', '/notifications/preferences', { delivery: true });
  await notify({ to: { type: 'CUSTOMER', id: alice }, category: 'DELIVERY', title: 'Pref test on', body: 'x', key: 'pref-2' });
  await new Promise((resolve) => setTimeout(resolve, 200));
  assert.equal(pushes.filter((push) => push.title === 'Pref test on' && push.token === 'token-alice-1234').length, 1);
  assert.equal((await call('DELETE', '/devices/push-tokens/phone-1')).status, 200);

  // sellers: the header bell shows new orders and customer cancellations, and can be marked read
  const alerts = (await sellerCall(sellerA, 'GET', '/dashboard/alerts')).body;
  const alertTitles = alerts.data.map((alert) => alert.title);
  assert.ok(alertTitles.includes('New order to ship') && alertTitles.includes('Order cancelled by customer'), alertTitles.join(' | '));
  assert.ok(alerts.meta.unread >= 2);
  const sample = alerts.data[0];
  assert.deepEqual(Object.keys(sample).sort(), ['at', 'body', 'id', 'link', 'read', 'severity', 'title']);
  await sellerCall(sellerA, 'POST', `/dashboard/alerts/${encodeURIComponent(sample.id)}/read`);
  assert.equal((await sellerCall(sellerA, 'GET', '/dashboard/alerts')).body.meta.unread, alerts.meta.unread - 1);
  assert.equal((await sellerCall(sellerB, 'GET', '/dashboard/alerts')).body.data.every((alert) => alert.id !== sample.id), true); // another seller's bell is separate

  // ============================================================== live updates and the admin console
  const { io } = await import('socket.io-client');
  const connect = async (claims) => {
    const socket = io(`http://127.0.0.1:${server.address().port}`, { auth: { token: signAccessToken(claims) }, transports: ['websocket'] });
    const seen = { orders: [], notifications: 0 };
    socket.on('order:changed', (hint) => seen.orders.push(hint));
    socket.on('notification:changed', () => { seen.notifications += 1; });
    await new Promise((resolve, reject) => { socket.once('session:ready', resolve); socket.once('connect_error', reject); });
    return { socket, seen };
  };
  const until = async (check, what) => {
    for (let waited = 0; waited < 3000; waited += 25) {
      if (check()) return;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    assert.fail(`never happened: ${what}`);
  };
  const adminUser = await User.create({ role: 'ADMIN', email: 'ops@orders.test', name: 'Ops', permissions: ['*'] });
  const noPermAdmin = await User.create({ role: 'ADMIN', email: 'noperm@orders.test', name: 'Nobody', permissions: [] });
  const adminCall = async (path, as = adminUser) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/admin/v1${path}`, { headers: { authorization: `Bearer ${signAccessToken({ sub: String(as._id), role: 'ADMIN' })}` } });
    return { status: response.status, body: await response.json() };
  };
  const bob = String(new mongoose.Types.ObjectId());
  const sellerSide = (sellerId) => ({ sub: String(new mongoose.Types.ObjectId()), role: 'SELLER', sellerId });
  const watchers = {
    customer: await connect({ sub: alice, role: 'CUSTOMER' }),
    sellerA: await connect(sellerSide(sellerA)),
    sellerB: await connect(sellerSide(sellerB)),
    admin: await connect({ sub: String(adminUser._id), role: 'ADMIN' }),
    stranger: await connect({ sub: bob, role: 'CUSTOMER' }),
  };
  t.after(() => Object.values(watchers).forEach(({ socket }) => socket.disconnect()));
  const last = (who) => watchers[who].seen.orders.at(-1)?.status;

  // placing an order reaches the customer, the seller in it and the admin console at once; nobody else hears of it
  const live = await buyNow([{ offerId: mug, quantity: 1 }]);
  const liveParcel = String(live.order.subOrders[0]._id);
  await until(() => ['customer', 'sellerA', 'admin'].every((who) => last(who) === 'CONFIRMED'), 'placed reaches customer, seller and admin');
  await until(() => watchers.customer.seen.notifications > 0 && watchers.sellerA.seen.notifications > 0, 'notification hints');
  assert.equal(watchers.sellerB.seen.orders.length, 0); // another seller is not in this order
  assert.equal(watchers.stranger.seen.orders.length, 0); // and another customer never hears of it
  assert.equal(watchers.customer.seen.orders.at(-1).orderId, String(live.order._id));

  // every status change after that is pushed the moment it commits, in order, to all three
  const steps = [];
  const expectEverywhere = async (status) => {
    steps.push(status);
    await until(() => ['customer', 'sellerA', 'admin'].every((who) => last(who) === status), `${status} reaches customer, seller and admin`);
    // the hint is only a nudge: what a screen then fetches is the committed truth, and it agrees
    assert.equal((await call('GET', `/orders/${live.order._id}`)).body.data.status, status);
    assert.equal((await adminCall(`/orders/${live.order.number}`)).body.data.status, status);
  };
  await sellerCall(sellerA, 'POST', `/orders/${liveParcel}/confirm`);
  await expectEverywhere('PROCESSING');
  await sellerCall(sellerA, 'POST', `/orders/${liveParcel}/ready-to-ship`);
  await expectEverywhere('READY_TO_SHIP');
  const liveAwb = (await sellerCall(sellerA, 'GET', `/orders/${liveParcel}`)).body.data.awb;
  await track(liveAwb, 'PICKED UP', '22 11 2026 09:00:00');
  await expectEverywhere('SHIPPED');
  await track(liveAwb, 'OUT FOR DELIVERY', '22 11 2026 12:00:00');
  await expectEverywhere('OUT_FOR_DELIVERY');
  await track(liveAwb, 'DELIVERED', '22 11 2026 15:00:00');
  await expectEverywhere('DELIVERED');
  assert.deepEqual(watchers.customer.seen.orders.filter((hint) => hint.orderId === String(live.order._id)).map((hint) => hint.status), ['CONFIRMED', ...steps]);

  // a cancellation is live too, and a seller cancelling their part updates the customer and admin immediately
  const toCancel = await buyNow([{ offerId: mug, quantity: 1 }, { offerId: lamp, quantity: 1 }]);
  await until(() => watchers.sellerB.seen.orders.some((hint) => hint.orderId === String(toCancel.order._id)), 'second order reaches seller B');
  const lampSub = toCancel.order.subOrders.find((sub) => sub.sellerId === sellerB);
  await sellerCall(sellerB, 'POST', `/orders/${lampSub._id}/cancel`, { reason: 'Damaged' });
  await until(() => watchers.customer.seen.orders.filter((hint) => hint.orderId === String(toCancel.order._id)).length >= 2, 'partial cancel reaches the customer');
  await call('POST', `/orders/${toCancel.order._id}/cancel`, {});
  await until(() => ['customer', 'sellerA', 'sellerB', 'admin'].every((who) => watchers[who].seen.orders.some((hint) => hint.orderId === String(toCancel.order._id) && hint.status === 'CANCELLED')), 'cancel reaches everyone');

  // admin console: who may read, the list with filters and tab counts, and the detail page's pieces
  assert.equal((await adminCall('/orders', noPermAdmin)).status, 403);
  const adminList = await adminCall('/orders?pageSize=100');
  assert.equal(adminList.status, 200, JSON.stringify(adminList.body));
  const row = adminList.body.data.find((entry) => entry.id === live.order.number);
  assert.deepEqual([row.status, row.customerName, row.paymentStatus, row.sellerNames, row.grandTotalPaise], ['DELIVERED', 'Alice Rao', 'CAPTURED', ['Ord A'], live.order.totals.payablePaise]);
  assert.deepEqual(row.courierNames, ['BlueDart']);
  assert.ok(adminList.body.meta.facets.status.DELIVERED >= 2 && adminList.body.meta.facets.status.CANCELLED >= 2);
  const deliveredList = await adminCall('/orders?status=DELIVERED');
  assert.ok(deliveredList.body.data.length >= 2 && deliveredList.body.data.every((entry) => entry.status === 'DELIVERED'));
  assert.equal(deliveredList.body.meta.facets.status.CANCELLED >= 2, true); // tab counts ignore the tab itself
  assert.ok((await adminCall(`/orders?q=${live.order.number.slice(0, 8)}`)).body.data.some((entry) => entry.id === live.order.number));
  assert.equal((await adminCall('/orders?q=zzzz-no-such')).body.meta.total, 0);
  const detail = (await adminCall(`/orders/${live.order.number}`)).body;
  assert.deepEqual([detail.data.address.cityLine, detail.data.priceDetails.grandTotalPaise], ['Ahmedabad, Gujarat 380015', live.order.totals.payablePaise]);
  assert.deepEqual(detail.meta.shipments.map((parcel) => [parcel.sellerName, parcel.status, parcel.awb]), [['Ord A', 'DELIVERED', liveAwb]]);
  assert.equal(detail.meta.payments[0].status, 'CAPTURED');
  assert.deepEqual(detail.meta.events.map((event) => event.status).reverse(), ['CONFIRMED', 'ACCEPTED', 'READY_TO_SHIP', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED']);
  assert.equal(detail.meta.customer.email, 'alice@customer.test');
  assert.equal((await adminCall(`/orders/${live.order._id}`)).status, 200); // by id as well
  assert.equal((await adminCall('/orders/ARSNOPE')).status, 404);
  const cancelledDetail = (await adminCall(`/orders/${toCancel.order.number}`)).body;
  assert.equal(cancelledDetail.meta.refunds.length >= 1, true);
  assert.equal(cancelledDetail.data.paymentStatus, 'REFUNDED');

  // ======================================================================= pickup address
  const addressNow = (await sellerCall(sellerA, 'GET', '/settings/address')).body.data;
  assert.deepEqual([addressNow.address, addressNow.pincode, addressNow.contact.email, addressNow.registeredWithCourier], ['1 Warehouse Road', '380015', 'owner1@seller.test', true]);
  const bad = { address: 'Ahmedabad', city: 'Ahmedabad', state: 'Gujarat', pincode: '380015' };
  assert.equal((await sellerCall(sellerA, 'PUT', '/settings/address', bad)).status, 422); // too short, no number
  assert.equal((await sellerCall(sellerA, 'PUT', '/settings/address', { ...bad, address: 'Warehouse Road Ahmedabad' })).status, 422); // long enough but no number
  assert.equal((await sellerCall(sellerA, 'PUT', '/settings/address', { ...bad, address: '12 Warehouse Road', pincode: '12' })).status, 422);
  const moved = await sellerCall(sellerA, 'PUT', '/settings/address', { address: '45, Industrial Estate, Naroda', locality: 'Naroda', city: 'Ahmedabad', state: 'Gujarat', pincode: '382330' });
  assert.deepEqual([moved.status, moved.body.data.address, moved.body.data.pincode], [200, '45, Industrial Estate, Naroda', '382330']);
  assert.equal((await sellerCall(sellerA, 'GET', '/settings/address')).body.data.pincode, '382330');

  // the next shipment registers the new address with the courier (once); the one after reuses it
  const registrations = () => shiprocket.calls.filter((name) => name === 'ensurePickupLocation').length;
  const registeredBefore = registrations();
  for (const round of [1, 2]) {
    const next = await buyNow([{ offerId: mug, quantity: 1 }]);
    const parcel = String(next.order.subOrders[0]._id);
    await sellerCall(sellerA, 'POST', `/orders/${parcel}/confirm`);
    assert.equal((await sellerCall(sellerA, 'POST', `/orders/${parcel}/ready-to-ship`)).status, 200);
    assert.equal(registrations(), registeredBefore + 1, `after shipment ${round}`);
  }

  // testing without a courier account: "mock ready to ship" never calls Shiprocket, and tracking updates still drive it on
  await Offer.updateOne({ _id: mug }, { $inc: { stock: 10 } }); // the earlier sections used up the mug
  const callsBefore = shiprocket.calls.length;
  const mocked = await buyNow([{ offerId: mug, quantity: 1 }]);
  const mockedParcel = String(mocked.order.subOrders[0]._id);
  assert.equal((await sellerCall(sellerA, 'POST', `/orders/${mockedParcel}/mock-ready-to-ship`)).body.error.code, 'ILLEGAL_TRANSITION'); // accept first
  await sellerCall(sellerA, 'POST', `/orders/${mockedParcel}/confirm`);
  const mockRow = (await sellerCall(sellerA, 'POST', `/orders/${mockedParcel}/mock-ready-to-ship`)).body.data;
  assert.deepEqual([mockRow.status, mockRow.courierName, mockRow.awb.startsWith('MOCK')], ['READY_TO_SHIP', 'Mock Courier', true]);
  assert.equal((await sellerCall(sellerA, 'POST', `/orders/${mockedParcel}/mock-ready-to-ship`)).status, 200); // again: nothing changes
  assert.equal(shiprocket.calls.length, callsBefore);
  assert.equal((await sellerCall(sellerB, 'POST', `/orders/${mockedParcel}/mock-ready-to-ship`)).status, 404);
  await track(mockRow.awb, 'DELIVERED', '22 11 2026 18:00:00');
  assert.equal((await call('GET', `/orders/${mocked.order._id}`)).body.data.status, 'DELIVERED');
  const deliveredParcel = (await Order.findById(mocked.order._id)).subOrders[0];
  assert.ok(deliveredParcel.deliveredAt); // the return window starts here, with the policy the item was sold under
  assert.equal(deliveredParcel.items[0].returnWindowDays, 7);

  // ======================================================================= admin overrides a parcel's status
  await Offer.updateOne({ _id: mug }, { $inc: { stock: 10 } });
  const adminPost = async (path, body, as = adminUser) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/admin/v1${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${signAccessToken({ sub: String(as._id), role: 'ADMIN' })}` },
      body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  };
  const viewer = await User.create({ role: 'ADMIN', email: 'viewer@orders.test', name: 'Viewer', permissions: ['orders.order.view'] });
  const forced = await buyNow([{ offerId: mug, quantity: 1 }]);
  const forcedParcel = String(forced.order.subOrders[0]._id);
  const setStatus = (status, reason = 'Customer called support', as = adminUser) => adminPost(`/orders/${forced.order.number}/parcels/${forcedParcel}/status`, { status, reason }, as);

  // who may: the button only exists for admins with the permission, and the call needs it too
  assert.deepEqual((await adminCall(`/orders/${forced.order.number}`, viewer)).body.meta.allowedActions, []);
  assert.deepEqual((await adminCall(`/orders/${forced.order.number}`)).body.meta.allowedActions, ['OVERRIDE_STATUS']);
  assert.equal((await setStatus('DELIVERED', 'x', viewer)).status, 403);
  assert.equal((await setStatus('DELIVERED', 'no')).status, 422);
  assert.equal((await setStatus('FLYING')).status, 422);

  // any status, forward or back: the order follows, and the customer's timeline follows it
  const jumped = await setStatus('DELIVERED');
  assert.equal(jumped.status, 200, JSON.stringify(jumped.body));
  assert.deepEqual([jumped.body.data.status, jumped.body.meta.shipments[0].status], ['DELIVERED', 'DELIVERED']);
  await until(() => last('customer') === 'DELIVERED', 'override reaches the customer live');
  assert.equal((await setStatus('DELIVERED')).status, 200); // same status: nothing changes
  const back = await setStatus('ACCEPTED', 'Marked delivered by mistake');
  assert.equal(back.body.data.status, 'PROCESSING');
  const customerView = (await call('GET', `/orders/${forced.order._id}`)).body.data;
  assert.deepEqual(customerView.timeline.map((step) => step.completed), [true, true, false, false, false, false]);
  const history = back.body.meta.events.filter((event) => event.actorType === 'ADMIN');
  assert.deepEqual(history.map((event) => [event.status, event.note]), [['ACCEPTED', 'Marked delivered by mistake'], ['DELIVERED', 'Customer called support']]);
  assert.ok(await mongoose.connection.collection('auditLogs').findOne({ action: 'order.parcel.status.override', reason: 'Customer called support' }));

  // a courier update never undoes what the admin set
  await sellerCall(sellerA, 'POST', `/orders/${forcedParcel}/mock-ready-to-ship`);
  const forcedAwb = (await sellerCall(sellerA, 'GET', `/orders/${forcedParcel}`)).body.data.awb;
  await setStatus('DELIVERED', 'Delivered by hand to the customer');
  await track(forcedAwb, 'PICKED UP', '23 11 2026 09:00:00'); // arrives late: the parcel is already delivered
  assert.equal((await adminCall(`/orders/${forced.order.number}`)).body.data.status, 'DELIVERED');
  await setStatus('SHIPPED', 'Courier reported it shipped again');
  await track(forcedAwb, 'DELIVERED', '23 11 2026 12:00:00'); // but real progress past the admin's status still applies
  assert.equal((await adminCall(`/orders/${forced.order.number}`)).body.data.status, 'DELIVERED');

  // cancelling is the real cancellation, and it is final
  const toCancelByAdmin = await buyNow([{ offerId: mug, quantity: 1 }]);
  const cancelParcel = String(toCancelByAdmin.order.subOrders[0]._id);
  const mugStock = (await stockOf(mug))[0];
  const refundsBeforeAdmin = refunds.length;
  const adminCancelled = await adminPost(`/orders/${toCancelByAdmin.order.number}/parcels/${cancelParcel}/status`, { status: 'CANCELLED', reason: 'Fraud check failed' });
  assert.deepEqual([adminCancelled.status, adminCancelled.body.data.status, adminCancelled.body.data.paymentStatus], [200, 'CANCELLED', 'REFUNDED']);
  assert.equal((await stockOf(mug))[0], mugStock + 1);
  assert.deepEqual(refunds.slice(refundsBeforeAdmin).map((refund) => refund.amountPaise), [toCancelByAdmin.order.totals.payablePaise]);
  assert.equal((await adminPost(`/orders/${toCancelByAdmin.order.number}/parcels/${cancelParcel}/status`, { status: 'ACCEPTED', reason: 'Reopen please' })).body.error.code, 'PARCEL_CANCELLED');
  assert.equal(refunds.length, refundsBeforeAdmin + 1);
  assert.ok((await sellerCall(sellerA, 'GET', '/dashboard/alerts')).body.data.some((alert) => alert.title === 'Order cancelled by Arise'));
  assert.ok((await call('GET', '/notifications?limit=50')).body.data.items.some((item) => item.body.includes('Arise cancelled')));
  assert.equal((await adminPost(`/orders/${forced.order.number}/parcels/${new mongoose.Types.ObjectId()}/status`, { status: 'DELIVERED', reason: 'whatever' })).status, 404);
  // ======================================================================= RTO: refunded and restocked once the parcel is back with the seller
  await Offer.updateOne({ _id: mug }, { $inc: { stock: 10 } });
  const rto = await buyNow([{ offerId: mug, quantity: 1 }]);
  const rtoParcel = String(rto.order.subOrders[0]._id);
  await sellerCall(sellerA, 'POST', `/orders/${rtoParcel}/confirm`);
  const rtoAwb = (await sellerCall(sellerA, 'POST', `/orders/${rtoParcel}/mock-ready-to-ship`)).body.data.awb;
  const stockBeforeRto = (await stockOf(mug))[0];
  const refundsBeforeRto = refunds.length;
  const itemsPaid = rto.order.subOrders[0].items.reduce((sum, item) => sum + item.amountPaise - item.discountPaise, 0);
  assert.ok(itemsPaid < rto.order.totals.payablePaise); // delivery and platform fees are not refunded
  await track(rtoAwb, 'PICKED UP', '24 11 2026 09:00:00');
  await track(rtoAwb, 'RTO INITIATED', '25 11 2026 09:00:00');
  assert.deepEqual([(await sellerCall(sellerA, 'GET', `/orders/${rtoParcel}`)).body.data.status, refunds.length, (await stockOf(mug))[0]], ['RTO', refundsBeforeRto, stockBeforeRto]); // still on its way back
  await track(rtoAwb, 'RTO DELIVERED', '28 11 2026 09:00:00');
  assert.deepEqual([(await sellerCall(sellerA, 'GET', `/orders/${rtoParcel}`)).body.data.status, (await Order.findById(rto.order._id)).status], ['RTO_DELIVERED', 'CANCELLED']);
  assert.deepEqual(refunds.slice(refundsBeforeRto).map((refund) => refund.amountPaise), [itemsPaid]);
  assert.equal((await stockOf(mug))[0], stockBeforeRto + 1);
  assert.equal((await Order.findById(rto.order._id)).refundedPaise, itemsPaid);
  assert.ok(await Invoice.findOne({ subOrderId: rtoParcel, docType: 'CREDIT_NOTE' }));
  assert.ok((await call('GET', '/notifications?limit=50')).body.data.items.some((item) => item.body.includes('came back to the seller')));
  await track(rtoAwb, 'RTO DELIVERED', '28 11 2026 10:00:00'); // a repeated scan changes nothing
  assert.equal(refunds.length, refundsBeforeRto + 1);
  assert.equal((await adminPost(`/orders/${rto.order.number}/parcels/${rtoParcel}/status`, { status: 'ACCEPTED', reason: 'Reopen please' })).body.error.code, 'PARCEL_CANCELLED');

  // ======================================================================= returns (customer side)
  const orderOf = (placed) => String(placed.order._id);
  const homeAddress = String((await AddressBook.findOne({ customerId: alice })).addresses[0]._id);
  const deliveredItem = (await Order.findById(mocked.order._id)).subOrders[0].items[0];
  const eligibility = async () => (await call('GET', `/orders/${orderOf(mocked)}/returnable-items`)).body.data;
  const asked = { orderId: orderOf(mocked), orderItemId: String(deliveredItem._id), resolution: 'REFUND', reasonCode: 'SIZE_FIT', pickupAddressId: homeAddress, evidenceMediaIds: [], refundDestination: 'ORIGINAL_PAYMENT' };
  const ask = (changes) => call('POST', '/returns', { ...asked, ...changes });

  const open = await eligibility();
  assert.deepEqual([open.items[0].eligible, open.items[0].allowedResolutions, open.refundDestinations, open.reasons.length], [true, ['REFUND'], ['ORIGINAL_PAYMENT'], 5]);
  assert.ok(new Date(open.items[0].returnWindowEndsAt) > new Date());
  assert.equal((await call('GET', `/orders/${orderOf(mocked)}`)).body.data.canReturn, true);
  const notDelivered = await call('GET', `/orders/${orderOf(rto)}/returnable-items`);
  assert.deepEqual([notDelivered.body.data.items[0].eligible, notDelivered.body.data.items[0].ineligibleReason], [false, 'Only delivered items can be returned.']);
  assert.equal((await call('POST', '/returns', { ...asked, orderId: orderOf(rto), orderItemId: String(rto.order.subOrders[0].items[0]._id) })).body.error.code, 'ITEM_NOT_RETURNABLE');

  // what the app sends is checked, not trusted
  assert.equal((await ask({ resolution: 'REPLACEMENT' })).body.error.code, 'RESOLUTION_NOT_AVAILABLE');
  assert.equal((await ask({ reasonCode: 'NOPE' })).body.error.code, 'RETURN_REASON_REQUIRED');
  assert.equal((await ask({ reasonCode: 'DAMAGED' })).body.error.code, 'EVIDENCE_REQUIRED');
  assert.equal((await ask({ reasonCode: 'DAMAGED', evidenceMediaIds: ['private/returns/someone-else/x.png'] })).body.error.code, 'EVIDENCE_INVALID');
  assert.equal((await ask({ pickupAddressId: String(new mongoose.Types.ObjectId()) })).body.error.code, 'PICKUP_ADDRESS_NOT_FOUND');

  // evidence: the app's RETURN_EVIDENCE upload lands in the customer's own private folder, and its id is accepted
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
  const form = new FormData();
  form.append('purpose', 'RETURN_EVIDENCE');
  form.append('file', new Blob([png], { type: 'image/png' }), 'damage.png');
  const upload = await fetch(`http://127.0.0.1:${server.address().port}/api/customer/v1/media/uploads`, { method: 'POST', headers: { authorization: `Bearer ${signAccessToken({ sub: alice, role: 'CUSTOMER' })}` }, body: form });
  const evidence = (await upload.json()).data;
  assert.equal(upload.status, 201, JSON.stringify(evidence));
  assert.match(evidence.id, new RegExp(`/returns/${alice}/`));

  const requested = await ask({ reasonCode: 'DAMAGED', evidenceMediaIds: [evidence.id] });
  assert.equal(requested.status, 201, JSON.stringify(requested.body));
  const request = requested.body.data;
  assert.deepEqual([request.status, request.resolution, request.evidenceMediaIds, request.pickupAddressId, request.refund], ['REQUESTED', 'REFUND', [evidence.id], homeAddress, { status: 'NOT_REQUIRED', amountPaise: deliveredItem.amountPaise - deliveredItem.discountPaise, destination: 'ORIGINAL_PAYMENT' }]);
  assert.equal((await ask({})).body.error.code, 'ITEM_NOT_RETURNABLE'); // one return per item
  assert.equal((await eligibility()).items[0].ineligibleReason, 'A return request already exists for this item.');
  assert.equal((await call('GET', `/orders/${orderOf(mocked)}`)).body.data.canReturn, false);
  // the status screen: the return carries its own timeline, what to show and whether it can still be withdrawn
  const shown = (await call('GET', `/returns/${request.id}`)).body.data;
  assert.deepEqual([shown.productName, shown.orderNumber, shown.canCancel, shown.courier, shown.timeline.map((step) => [step.status, step.label])], [deliveredItem.name, mocked.order.number, true, null, [['REQUESTED', 'Return requested']]]);
  assert.deepEqual(shown.journey.map((step) => step.state[0]).join(''), 'CPPPPPPP'); // just requested: the rest of the way to the refund is shown as still to come
  assert.equal(shown.journey.at(-1).label, 'Refund completed');
  const myReturns = (await call('GET', '/returns')).body.data;
  assert.deepEqual([myReturns.items.map((row) => row.id), myReturns.total, myReturns.nextCursor], [[request.id], 1, null]);
  const orderItem = (await call('GET', `/orders/${orderOf(mocked)}`)).body.data.items[0];
  assert.deepEqual([orderItem.returnId, orderItem.returnStatus], [request.id, 'REQUESTED']); // the order screen links to it
  assert.equal((await call('GET', `/returns/${request.id}`)).body.data.id, request.id);
  assert.equal((await call('GET', `/returns/${new mongoose.Types.ObjectId()}`)).status, 404);

  // withdrawn: the item can be returned again, until its window closes
  assert.equal((await call('POST', `/returns/${request.id}/cancel`)).body.data.status, 'CANCELLED');
  assert.equal((await call('POST', `/returns/${request.id}/cancel`)).body.data.status, 'CANCELLED'); // twice is harmless
  assert.equal((await eligibility()).items[0].eligible, true);
  await Order.updateOne({ _id: mocked.order._id }, { $set: { 'subOrders.0.deliveredAt': new Date(Date.now() - 8 * 86_400_000) } });
  assert.match((await eligibility()).items[0].ineligibleReason, /^The return window closed on /);
  assert.equal((await ask({})).body.error.code, 'ITEM_NOT_RETURNABLE');

  // ======================================================================= returns (seller side)
  await Order.updateOne({ _id: mocked.order._id }, { $set: { 'subOrders.0.deliveredAt': new Date() } });
  const damaged = (await ask({ reasonCode: 'DAMAGED', evidenceMediaIds: [evidence.id], comment: 'Cracked handle' })).body.data;
  const sellerReturn = (path, method = 'GET', body, as = sellerA) => sellerCall(as, method, `/returns${path}`, body);
  const queue = await sellerReturn('?stage=REQUESTED');
  assert.equal(queue.status, 200, JSON.stringify(queue.body));
  assert.deepEqual([queue.body.data.length, queue.body.data[0].id, queue.body.data[0].status, queue.body.data[0].orderId, queue.body.meta.counts.REQUESTED], [1, damaged.id, 'RETURN_REQUESTED', mocked.order.number, 1]);
  assert.ok((await sellerCall(sellerA, 'GET', '/dashboard/alerts')).body.data.some((alert) => alert.title === 'New return request'));
  assert.equal((await sellerReturn(`/${damaged.id}`, 'GET', undefined, sellerB)).status, 404); // another seller's return is invisible
  assert.equal((await sellerReturn(`/${damaged.id}/approve`, 'POST', undefined, sellerB)).status, 404);
  const returnDetail = (await sellerReturn(`/${damaged.id}`)).body.data;
  assert.deepEqual([returnDetail.actions, returnDetail.comments, returnDetail.customerEvidence.length, returnDetail.policy.decisionOverdue], [['approve', 'reject'], 'Cracked handle', 1, false]);
  assert.equal((await sellerReturn(`/${damaged.id}/receive`, 'POST')).body.error.code, 'ILLEGAL_TRANSITION'); // decide first
  assert.equal((await sellerReturn(`/${damaged.id}/reject`, 'POST', { reasonCode: 'OTHER', reason: '' })).status, 422);

  const approved = (await sellerReturn(`/${damaged.id}/approve`, 'POST')).body.data;
  // approving books the courier to collect it from the customer
  assert.deepEqual([approved.status, approved.actions, approved.pickupAwb?.startsWith('AWB'), approved.reverseCourierName], ['PICKUP_SCHEDULED', ['receive'], true, 'BlueDart']);
  assert.equal((await call('GET', `/returns/${damaged.id}`)).body.data.pickupWindowLabel, `BlueDart will collect it (tracking ${approved.pickupAwb})`);
  assert.equal(shiprocket.calls.filter((name) => name === 'createReturnShipment').length, 1);
  assert.equal((await sellerReturn(`/${damaged.id}/approve`, 'POST')).body.data.status, 'PICKUP_SCHEDULED'); // twice is harmless: no second courier booking
  assert.ok((await call('GET', '/notifications?limit=50')).body.data.items.some((item) => item.body.includes('was approved')));
  // the courier's scans move it: collected from the customer, then delivered to the seller
  await track(approved.pickupAwb, 'PICKED UP', '26 11 2026 10:00:00');
  assert.equal((await call('GET', `/returns/${damaged.id}`)).body.data.status, 'PICKED_UP');
  assert.equal((await call('POST', `/returns/${damaged.id}/cancel`)).body.error.code, 'RETURN_NOT_CANCELLABLE'); // too late to withdraw: the courier has it
  assert.deepEqual([(await call('GET', `/returns/${damaged.id}`)).body.data.canCancel, (await call('GET', `/returns/${damaged.id}`)).body.data.courier.awb], [false, approved.pickupAwb]);
  await track(approved.pickupAwb, 'DELIVERED', '27 11 2026 10:00:00');
  assert.equal((await call('GET', `/returns/${damaged.id}`)).body.data.status, 'RECEIVED');
  assert.equal((await sellerReturn(`/${damaged.id}`)).body.data.actions.includes('qc'), true);
  assert.ok((await call('GET', '/notifications?limit=50')).body.data.items.some((item) => item.title === 'Return picked up'));
  assert.equal((await sellerReturn(`/${damaged.id}/qc`, 'POST', { result: 'FAIL', reasonCode: 'USED_OR_DAMAGED', notes: '' })).status, 422); // a fail must say why
  const stockBeforeReturn = (await stockOf(mug))[0];
  const refundsBeforeReturn = refunds.length;
  const refundedBefore = (await Order.findById(mocked.order._id)).refundedPaise;
  const returnPaid = deliveredItem.amountPaise - deliveredItem.discountPaise;
  const checked = (await sellerReturn(`/${damaged.id}/qc`, 'POST', { result: 'PASS', notes: 'Handle is cracked as shown' })).body.data;
  assert.deepEqual([checked.status, checked.qcResult, checked.actions, checked.refund.status], ['CLOSED', 'PASS', [], 'COMPLETED']);
  assert.equal((await call('GET', `/returns/${damaged.id}`)).body.data.status, 'REFUND_COMPLETED');
  assert.equal((await call('GET', `/returns/${damaged.id}`)).body.data.journey.every((step) => step.state === 'DONE'), true); // all the way to the refund
  assert.deepEqual(refunds.slice(refundsBeforeReturn).map((refund) => refund.amountPaise), [returnPaid]); // the item only: no delivery or platform fee
  assert.equal((await stockOf(mug))[0], stockBeforeReturn + 1); // QC passed: back on sale
  assert.equal((await Order.findById(mocked.order._id)).refundedPaise, refundedBefore + returnPaid);
  const creditNote = await Invoice.findOne({ subOrderId: mocked.order.subOrders[0]._id, docType: 'CREDIT_NOTE' }).lean();
  assert.deepEqual([creditNote.totals.totalPaise, creditNote.lines.length, creditNote.reason], [returnPaid, 1, 'Item returned']);
  assert.ok((await call('GET', '/notifications?limit=50')).body.data.items.some((item) => item.title === 'Refund completed'));
  await sellerReturn(`/${damaged.id}/qc`, 'POST', { result: 'PASS', notes: 'again' }); // a repeat pays nothing twice
  assert.equal(refunds.length, refundsBeforeReturn + 1);

  // a refund Razorpay has not finished yet: initiated now, completed when its webhook arrives
  const pending = (await Order.findById(single.order._id)).subOrders[0];
  const pendingItem = pending.items[0];
  const realRefund = paymentGateway.refund;
  paymentGateway.refund = async (args) => ({ ...(await realRefund(args)), providerStatus: 'created' });
  const later = (await ask({ orderId: orderOf(single), orderItemId: String(pendingItem._id) })).body.data;
  // a failing Shiprocket step leaves the approval standing; booking again resumes instead of starting over
  const shipmentsBefore = shiprocket.calls.filter((name) => name === 'createReturnShipment').length;
  shiprocket.failNext = 'assignAwb';
  const stuck = (await sellerReturn(`/${later.id}/approve`, 'POST')).body.data;
  assert.deepEqual([stuck.status, stuck.actions.includes('schedule-pickup')], ['RETURN_APPROVED', true]);
  const booked = (await sellerReturn(`/${later.id}/schedule-pickup`, 'POST')).body.data;
  assert.deepEqual([booked.status, Boolean(booked.pickupAwb), shiprocket.calls.filter((name) => name === 'createReturnShipment').length], ['PICKUP_SCHEDULED', true, shipmentsBefore + 1]);
  assert.equal((await sellerReturn(`/${later.id}/schedule-pickup`, 'POST')).body.data.pickupAwb, booked.pickupAwb); // again: nothing changes
  await sellerReturn(`/${later.id}/receive`, 'POST');
  const started = (await sellerReturn(`/${later.id}/qc`, 'POST', { result: 'PASS', notes: 'Fine' })).body.data;
  paymentGateway.refund = realRefund;
  assert.deepEqual([started.status, started.refund.status, (await call('GET', `/returns/${later.id}`)).body.data.status], ['QC_PASSED', 'PROCESSING', 'REFUND_INITIATED']);
  const refundOnPayment = (await Payment.findById(single.order.paymentId)).refunds.find((refund) => refund.key === `return:${later.id}`);
  const refundReceipt = await WebhookReceipt.create({
    provider: 'RAZORPAY', providerEventId: `evt_refund_${later.id}`, eventType: 'refund.processed',
    payload: { event: 'refund.processed', payload: { refund: { entity: { id: refundOnPayment.providerRefundId, payment_id: 'pay_x', amount: refundOnPayment.amountPaise, status: 'processed' } } } },
  });
  await processReceipt(refundReceipt._id);
  assert.deepEqual([(await call('GET', `/returns/${later.id}`)).body.data.status, (await call('GET', `/returns/${later.id}`)).body.data.refund.status], ['REFUND_COMPLETED', 'SUCCEEDED']);
  assert.deepEqual((await sellerReturn('?stage=COMPLETED')).body.data.map((row) => row.id), [later.id, damaged.id, request.id]); // newest first; the withdrawn one is completed too

  // a rejection is final: the customer is told why and cannot ask again for that item
  const forcedItem = (await Order.findById(forced.order._id)).subOrders[0].items[0];
  const rejected = (await ask({ orderId: orderOf(forced), orderItemId: String(forcedItem._id) })).body.data;
  const turnedDown = (await sellerReturn(`/${rejected.id}/reject`, 'POST', { reasonCode: 'POLICY_NOT_MET', reason: 'Item was used' })).body.data;
  assert.deepEqual([turnedDown.status, turnedDown.actions], ['RETURN_REJECTED', []]);
  assert.ok((await call('GET', '/notifications?limit=50')).body.data.items.some((item) => item.body.includes('Item was used')));
  assert.equal((await ask({ orderId: orderOf(forced), orderItemId: String(forcedItem._id) })).body.error.code, 'ITEM_NOT_RETURNABLE');

  // ======================================================================= returns (admin side)
  assert.equal((await adminCall('/returns', viewer)).status, 403); // the console's returns need their own permission
  const rejectedList = (await adminCall('/returns?status=RETURN_REJECTED')).body;
  const rejectedRow = rejectedList.data.find((row) => row.id === rejected.id);
  assert.deepEqual([rejectedRow.customerName, rejectedRow.sellerName, rejectedRow.faultAttribution, rejectedRow.orderId, rejectedList.meta.facets.status.RETURN_REJECTED >= 1], ['Alice Rao', 'Ord A', 'CUSTOMER', forced.order.number, true]);
  assert.equal((await adminCall('/returns?status=RETURN_REJECTED&sellerId=nobody')).body.data.length, 0);
  assert.equal((await adminCall(`/returns?q=${forced.order.number}`)).body.data.length, 1);
  assert.deepEqual((await adminCall(`/returns/${rejected.id}`)).body.meta.allowedActions, ['OVERRIDE_REJECTION', 'CANCEL_RETURN']);
  assert.deepEqual((await adminCall(`/orders/${forced.order.number}`)).body.meta.items[0].returnId, rejected.id);
  assert.equal((await adminCall(`/orders/${forced.order.number}`)).body.meta.returns.length, 1);
  assert.equal((await adminCall(`/orders?q=${forced.order.number}`)).body.data[0].hasReturn, true);

  // overriding a seller's rejection reopens it and books the courier; the admin then drives it to the refund
  assert.equal((await adminPost(`/returns/${rejected.id}/override-rejection`, { reason: '' })).status, 422);
  assert.equal((await adminPost(`/returns/${rejected.id}/override-rejection`, { reason: 'Item was sealed' }, viewer)).status, 403);
  const reopened = await adminPost(`/returns/${rejected.id}/override-rejection`, { reason: 'Photos show it was unused' });
  assert.deepEqual([reopened.status, reopened.body.data.status, reopened.body.data.overrideReason, Boolean(reopened.body.data.pickupAwb)], [200, 'PICKUP_SCHEDULED', 'Photos show it was unused', true]);
  assert.ok(await mongoose.connection.collection('auditLogs').findOne({ action: 'orders.return.override_rejection', reason: 'Photos show it was unused' }));
  assert.deepEqual((await adminCall(`/returns/${rejected.id}`)).body.meta.allowedActions, ['MARK_RECEIVED', 'CANCEL_RETURN']);
  assert.equal((await adminPost(`/returns/${rejected.id}/mark-received`, {})).body.data.status, 'RECEIVED');
  assert.equal((await adminPost(`/returns/${rejected.id}/qc`, { result: 'FAIL', notes: 'x' })).status, 422); // a fail must say what was wrong
  const adminChecked = await adminPost(`/returns/${rejected.id}/qc`, { result: 'PASS', notes: 'Unused' });
  assert.deepEqual([adminChecked.body.data.status, adminChecked.body.data.refundId, adminChecked.body.meta.refund.status], ['CLOSED', `return:${rejected.id}`, 'COMPLETED']);
  assert.equal((await adminCall(`/orders/${forced.order.number}`)).body.meta.refunds.at(-1).type, 'RETURN');

  // an admin raises a return for the customer: no photo needed, refund only
  await Offer.updateOne({ _id: mug }, { $inc: { stock: 5 } });
  const raised = await buyNow([{ offerId: mug, quantity: 1 }]);
  const raisedParcel = String(raised.order.subOrders[0]._id);
  await sellerCall(sellerA, 'POST', `/orders/${raisedParcel}/confirm`);
  const raisedAwb = (await sellerCall(sellerA, 'POST', `/orders/${raisedParcel}/mock-ready-to-ship`)).body.data.awb;
  const raisedItem = String(raised.order.subOrders[0].items[0]._id);
  const raise = (body, as) => adminPost(`/orders/${raised.order.number}/items/${raisedItem}/return`, body, as);
  assert.equal((await raise({ reason: 'DAMAGED' })).body.error.code, 'ITEM_NOT_RETURNABLE'); // not delivered yet
  await track(raisedAwb, 'DELIVERED', '25 11 2026 12:00:00');
  assert.equal((await raise({ reason: 'DAMAGED' }, viewer)).status, 403);
  assert.equal((await raise({ reason: 'DAMAGED', type: 'REPLACEMENT' })).body.error.code, 'RESOLUTION_NOT_AVAILABLE');
  assert.equal((await raise({ reason: 'Whatever' })).body.error.code, 'RETURN_REASON_REQUIRED');
  const raisedReturn = await raise({ reason: 'Item is damaged or defective', comments: 'Customer phoned in' });
  assert.deepEqual([raisedReturn.status, raisedReturn.body.data.status, raisedReturn.body.data.timeline[0].actorType, raisedReturn.body.meta.allowedActions], [201, 'RETURN_REQUESTED', 'ADMIN', ['APPROVE', 'REJECT', 'CANCEL_RETURN']]);
  assert.equal((await raise({ reason: 'DAMAGED' })).body.error.code, 'ITEM_NOT_RETURNABLE'); // one open return per item
  const raisedApproved = await adminPost(`/returns/${raisedReturn.body.data.id}/approve`, {});
  assert.deepEqual([raisedApproved.body.data.status, Boolean(raisedApproved.body.data.pickupAwb)], ['PICKUP_SCHEDULED', true]);

  // ======================================================================= returns: a seller who misses the deadline loses the say
  await Offer.updateOne({ _id: mug }, { $inc: { stock: 5 } });
  const overdue = await buyNow([{ offerId: mug, quantity: 1 }]);
  const overdueParcel = String(overdue.order.subOrders[0]._id);
  await sellerCall(sellerA, 'POST', `/orders/${overdueParcel}/confirm`);
  await track((await sellerCall(sellerA, 'POST', `/orders/${overdueParcel}/mock-ready-to-ship`)).body.data.awb, 'DELIVERED', '26 11 2026 12:00:00');
  const overdueReturn = (await ask({ orderId: orderOf(overdue), orderItemId: String(overdue.order.subOrders[0].items[0]._id) })).body.data;
  const { autoApproveOverdueReturns } = await import('../src/modules/order/public/index.js');
  const { Return } = await import('../src/modules/order/infrastructure/persistence/return.model.js');
  assert.equal(await autoApproveOverdueReturns(), 0); // still inside the seller's 48 hours
  assert.equal((await sellerReturn(`/${overdueReturn.id}`)).body.data.policy.decisionOverdue, false);
  await Return.updateOne({ _id: overdueReturn.id }, { $set: { decisionDueAt: new Date(Date.now() - 1000) } });
  assert.equal((await sellerReturn(`/${overdueReturn.id}`)).body.data.policy.decisionOverdue, true);
  assert.equal(await autoApproveOverdueReturns(), 1);
  assert.equal(await autoApproveOverdueReturns(), 0); // nothing left to do
  const autoApproved = (await sellerReturn(`/${overdueReturn.id}`)).body.data;
  assert.deepEqual([autoApproved.status, Boolean(autoApproved.pickupAwb), autoApproved.timeline.some((entry) => entry.actorType === 'SYSTEM' && entry.reason === 'The seller did not respond by the deadline')], ['PICKUP_SCHEDULED', true, true]);
  assert.ok((await sellerCall(sellerA, 'GET', '/dashboard/alerts')).body.data.some((alert) => alert.title === 'Return approved automatically'));

  // ... and one who never checks the returned item: the check counts as passed and the customer is refunded
  const { autoPassOverdueQc } = await import('../src/modules/order/public/index.js');
  assert.equal((await sellerReturn(`/${overdueReturn.id}/receive`, 'POST')).body.data.status, 'RECEIVED');
  const awaitingQc = (await sellerReturn(`/${overdueReturn.id}`)).body.data;
  assert.deepEqual([new Date(awaitingQc.policy.qcDueAt) > new Date(), awaitingQc.policy.qcOverdue], [true, false]);
  assert.equal(await autoPassOverdueQc(), 0); // still inside the seller's 72 hours
  const refundsBeforeQcDeadline = refunds.length;
  await Return.updateOne({ _id: overdueReturn.id }, { $set: { qcDueAt: new Date(Date.now() - 1000) } });
  assert.equal((await sellerReturn(`/${overdueReturn.id}`)).body.data.policy.qcOverdue, true);
  assert.equal(await autoPassOverdueQc(), 1);
  assert.equal(await autoPassOverdueQc(), 0);
  const autoChecked = (await sellerReturn(`/${overdueReturn.id}`)).body.data;
  assert.deepEqual([autoChecked.status, autoChecked.qcResult, autoChecked.refund.status, refunds.length], ['CLOSED', 'PASS', 'COMPLETED', refundsBeforeQcDeadline + 1]);
  assert.ok(autoChecked.timeline.some((entry) => entry.actorType === 'SYSTEM' && entry.reason === 'The seller did not check it by the deadline'));
  assert.ok((await sellerCall(sellerA, 'GET', '/dashboard/alerts')).body.data.some((alert) => alert.title === 'Return accepted automatically'));

  // ======================================================================= returns: a pickup the courier never makes
  const { chasePickups } = await import('../src/modules/order/public/index.js');
  await Offer.updateOne({ _id: mug }, { $inc: { stock: 5 } });
  const stranded = await buyNow([{ offerId: mug, quantity: 1 }]);
  const strandedParcel = String(stranded.order.subOrders[0]._id);
  await sellerCall(sellerA, 'POST', `/orders/${strandedParcel}/confirm`);
  await track((await sellerCall(sellerA, 'POST', `/orders/${strandedParcel}/mock-ready-to-ship`)).body.data.awb, 'DELIVERED', '27 11 2026 12:00:00');
  const strandedAsk = { orderId: orderOf(stranded), orderItemId: String(stranded.order.subOrders[0].items[0]._id) };
  const strandedReturn = (await ask(strandedAsk)).body.data;
  const pickupBooked = (await sellerReturn(`/${strandedReturn.id}/approve`, 'POST')).body.data;
  assert.deepEqual([pickupBooked.status, new Date(pickupBooked.policy.pickupDueAt) > new Date()], ['PICKUP_SCHEDULED', true]);
  assert.deepEqual(await chasePickups(), { booked: 0, chased: 0, lapsed: 0 }); // the courier still has time

  // overdue: the courier is asked again and gets a few more days; overdue again: the return lapses
  const requestsBefore = shiprocket.calls.filter((name) => name === 'requestPickup').length;
  await Return.updateOne({ _id: strandedReturn.id }, { $set: { 'reverse.pickupDueAt': new Date(Date.now() - 1000) } });
  assert.deepEqual(await chasePickups(), { booked: 0, chased: 1, lapsed: 0 });
  assert.equal(shiprocket.calls.filter((name) => name === 'requestPickup').length, requestsBefore + 1);
  const chased = (await sellerReturn(`/${strandedReturn.id}`)).body.data;
  assert.deepEqual([chased.status, new Date(chased.policy.pickupDueAt) > new Date()], ['PICKUP_SCHEDULED', true]);
  await Return.updateOne({ _id: strandedReturn.id }, { $set: { 'reverse.pickupDueAt': new Date(Date.now() - 1000) } });
  const cancelsBeforeLapse = shiprocket.calls.filter((name) => name === 'cancelShipment').length;
  assert.deepEqual(await chasePickups(), { booked: 0, chased: 0, lapsed: 1 });
  assert.equal(shiprocket.calls.filter((name) => name === 'cancelShipment').length, cancelsBeforeLapse + 1); // the lapsed booking is cancelled on Shiprocket too
  assert.deepEqual(await chasePickups(), { booked: 0, chased: 0, lapsed: 0 });
  assert.equal((await call('GET', `/returns/${strandedReturn.id}`)).body.data.status, 'CANCELLED');
  assert.ok((await call('GET', '/notifications?limit=50')).body.data.items.some((item) => item.title === 'Return cancelled'));
  assert.equal((await sellerReturn(`/${strandedReturn.id}`)).body.data.status, 'RETURN_CANCELLED');

  // the item can be asked for again; an approval whose courier booking failed is booked again later
  const reAsked = (await ask(strandedAsk)).body.data;
  shiprocket.failNext = 'assignAwb';
  assert.equal((await sellerReturn(`/${reAsked.id}/approve`, 'POST')).body.data.status, 'RETURN_APPROVED');
  assert.deepEqual(await chasePickups(), { booked: 0, chased: 0, lapsed: 0 }); // too soon to retry
  await Return.updateOne({ _id: reAsked.id }, { $set: { updatedAt: new Date(Date.now() - 3_600_000) } }, { timestamps: false });
  const shipmentsBeforeRetry = shiprocket.calls.filter((name) => name === 'createReturnShipment').length;
  assert.deepEqual(await chasePickups(), { booked: 1, chased: 0, lapsed: 0 });
  assert.deepEqual([(await sellerReturn(`/${reAsked.id}`)).body.data.status, shiprocket.calls.filter((name) => name === 'createReturnShipment').length], ['PICKUP_SCHEDULED', shipmentsBeforeRetry]); // resumed, not started over

  // ======================================================================= returns: the customer withdraws after approval
  const cancels = () => shiprocket.calls.filter((name) => name === 'cancelShipment').length;
  const withdrawnAwb = (await sellerReturn(`/${reAsked.id}`)).body.data.pickupAwb;
  const cancelsBefore = cancels();
  const withdrawn = await call('POST', `/returns/${reAsked.id}/cancel`); // booked, not collected yet
  assert.deepEqual([withdrawn.status, withdrawn.body.data.status, cancels()], [200, 'CANCELLED', cancelsBefore + 1]);
  assert.ok((await Return.findById(reAsked.id)).reverse.cancelledAt);
  assert.equal((await call('POST', `/returns/${reAsked.id}/cancel`)).body.data.status, 'CANCELLED'); // twice is harmless: no second cancel
  assert.equal(cancels(), cancelsBefore + 1);
  assert.ok((await sellerCall(sellerA, 'GET', '/dashboard/alerts')).body.data.some((alert) => alert.title === 'Return withdrawn by customer'));
  await track(withdrawnAwb, 'PICKED UP', '29 11 2026 09:00:00'); // a stray scan of the cancelled booking moves nothing
  assert.equal((await call('GET', `/returns/${reAsked.id}`)).body.data.status, 'CANCELLED');

  // if Shiprocket will not cancel it, the withdrawal still stands and the booking is flagged for ops
  const askedThird = (await ask(strandedAsk)).body.data;
  await sellerReturn(`/${askedThird.id}/approve`, 'POST');
  shiprocket.failNext = 'cancelShipment';
  const flagged = await call('POST', `/returns/${askedThird.id}/cancel`);
  assert.deepEqual([flagged.status, flagged.body.data.status], [200, 'CANCELLED']);
  const flaggedRow = await Return.findById(askedThird.id);
  assert.deepEqual([flaggedRow.reverse.cancelledAt, Boolean(flaggedRow.reverse.cancelError)], [null, true]);

  // ops hear about it once, find it in the console's "needs attention" list, and retry from there
  assert.ok(flaggedRow.reverse.opsAlertedAt);
  const attention = (await adminCall('/returns?needsAttention=true')).body.data;
  assert.deepEqual([attention.map((row) => row.id), attention[0].pickupCancelFailed], [[askedThird.id], true]);
  assert.ok((await adminCall(`/returns/${askedThird.id}`)).body.meta.pickupCancelError);
  assert.equal((await adminPost(`/returns/${askedThird.id}/cancel-pickup`, {}, viewer)).status, 403);
  assert.equal((await adminPost(`/returns/${new mongoose.Types.ObjectId()}/cancel-pickup`, {})).status, 404);
  shiprocket.failNext = 'cancelShipment';
  assert.equal((await adminPost(`/returns/${askedThird.id}/cancel-pickup`, {})).status, 502); // still refused: the admin sees why
  const stillFlagged = await Return.findById(askedThird.id);
  assert.deepEqual([Boolean(stillFlagged.reverse.cancelError), String(stillFlagged.reverse.opsAlertedAt)], [true, String(flaggedRow.reverse.opsAlertedAt)]); // no second email
  const retried = await adminPost(`/returns/${askedThird.id}/cancel-pickup`, {});
  assert.deepEqual([retried.status, retried.body.data.pickupCancelFailed, retried.body.meta.pickupCancelError], [200, false, null]);
  assert.ok((await Return.findById(askedThird.id)).reverse.cancelledAt);
  assert.equal((await adminCall('/returns?needsAttention=true')).body.data.length, 0);
  assert.equal((await adminPost(`/returns/${askedThird.id}/cancel-pickup`, {})).status, 200); // again: nothing to do
  assert.equal((await adminPost(`/returns/${reAsked.id}/cancel-pickup`, {})).status, 200);
  assert.ok(await mongoose.connection.collection('auditLogs').findOne({ action: 'orders.return.cancel_pickup' }));
  const beforeApproval = (await ask(strandedAsk)).body.data; // withdrawn before approval: nothing to cancel
  const cancelsBeforeEarly = cancels();
  assert.equal((await call('POST', `/returns/${beforeApproval.id}/cancel`)).body.data.status, 'CANCELLED');
  assert.equal(cancels(), cancelsBeforeEarly);

  // ======================================================================= returns: an admin cancels one
  await Offer.updateOne({ _id: mug }, { $inc: { stock: 5 } });
  const adminCancelOrder = await buyNow([{ offerId: mug, quantity: 1 }]);
  const adminCancelParcel = String(adminCancelOrder.order.subOrders[0]._id);
  await sellerCall(sellerA, 'POST', `/orders/${adminCancelParcel}/confirm`);
  await track((await sellerCall(sellerA, 'POST', `/orders/${adminCancelParcel}/mock-ready-to-ship`)).body.data.awb, 'DELIVERED', '28 11 2026 12:00:00');
  const adminCancelAsk = { orderId: orderOf(adminCancelOrder), orderItemId: String(adminCancelOrder.order.subOrders[0].items[0]._id) };
  const approvedByCancel = (await ask(adminCancelAsk)).body.data;
  await sellerReturn(`/${approvedByCancel.id}/approve`, 'POST'); // the seller approved it and a courier is booked
  assert.deepEqual((await adminCall(`/returns/${approvedByCancel.id}`)).body.meta.allowedActions, ['MARK_RECEIVED', 'CANCEL_RETURN']);
  assert.equal((await adminPost(`/returns/${approvedByCancel.id}/cancel`, { reason: 'Customer asked us to' }, viewer)).status, 403);
  assert.equal((await adminPost(`/returns/${approvedByCancel.id}/cancel`, { reason: '' })).status, 422);
  const cancelsBeforeAdmin = shiprocket.calls.filter((name) => name === 'cancelShipment').length;
  const cancelledByAdmin = await adminPost(`/returns/${approvedByCancel.id}/cancel`, { reason: 'Duplicate request' });
  assert.deepEqual([cancelledByAdmin.status, cancelledByAdmin.body.data.status, cancelledByAdmin.body.meta.allowedActions, shiprocket.calls.filter((name) => name === 'cancelShipment').length], [200, 'RETURN_CANCELLED', [], cancelsBeforeAdmin + 1]);
  assert.ok((await Return.findById(approvedByCancel.id)).reverse.cancelledAt);
  assert.equal((await call('GET', `/returns/${approvedByCancel.id}`)).body.data.status, 'CANCELLED');
  assert.ok((await call('GET', '/notifications?limit=50')).body.data.items.some((item) => item.body.includes('cancelled by Arise: Duplicate request')));
  assert.ok((await sellerCall(sellerA, 'GET', '/dashboard/alerts')).body.data.some((alert) => alert.title === 'Return cancelled by Arise'));
  assert.ok(await mongoose.connection.collection('auditLogs').findOne({ action: 'orders.return.cancel', reason: 'Duplicate request' }));
  assert.equal((await adminPost(`/returns/${approvedByCancel.id}/cancel`, { reason: 'Duplicate request' })).status, 200); // again: nothing more happens
  assert.equal(shiprocket.calls.filter((name) => name === 'cancelShipment').length, cancelsBeforeAdmin + 1);

  // a rejected return can be cancelled too, which lets the customer ask again; one the courier has cannot
  const rejectedByCancel = (await ask(adminCancelAsk)).body.data; // free again after the cancel
  await sellerReturn(`/${rejectedByCancel.id}/reject`, 'POST', { reasonCode: 'OTHER', reason: 'Looks used' });
  assert.equal((await ask(adminCancelAsk)).body.error.code, 'ITEM_NOT_RETURNABLE'); // a rejection is final for the customer
  assert.equal((await adminPost(`/returns/${rejectedByCancel.id}/cancel`, { reason: 'Reviewed the photos' })).body.data.status, 'RETURN_CANCELLED');
  const askedAfterCancel = (await ask(adminCancelAsk)).body.data;
  assert.equal(askedAfterCancel.status, 'REQUESTED');
  assert.equal((await adminPost(`/returns/${damaged.id}/cancel`, { reason: 'Too late' })).body.error.code, 'ILLEGAL_TRANSITION'); // already refunded

  // ======================================================================= returns: Razorpay refuses the refund, then it is retried
  await Offer.updateOne({ _id: mug }, { $inc: { stock: 5 } });
  const refused = await buyNow([{ offerId: mug, quantity: 1 }]);
  const refusedParcel = String(refused.order.subOrders[0]._id);
  await sellerCall(sellerA, 'POST', `/orders/${refusedParcel}/confirm`);
  await track((await sellerCall(sellerA, 'POST', `/orders/${refusedParcel}/mock-ready-to-ship`)).body.data.awb, 'DELIVERED', '29 11 2026 12:00:00');
  const refusedReturn = (await ask({ orderId: orderOf(refused), orderItemId: String(refused.order.subOrders[0].items[0]._id) })).body.data;
  await sellerReturn(`/${refusedReturn.id}/approve`, 'POST');
  await adminPost(`/returns/${refusedReturn.id}/mark-received`, {});
  const refundBeforeRefusal = paymentGateway.refund;
  paymentGateway.refund = async () => { throw new Error('Your account does not have enough balance to carry out the refund operation.'); };
  const refusedQc = await adminPost(`/returns/${refusedReturn.id}/qc`, { result: 'PASS', notes: 'Fine' });
  assert.deepEqual([refusedQc.body.data.status, refusedQc.body.meta.refund.status, refusedQc.body.meta.refund.failureReason, refusedQc.body.meta.allowedActions.includes('RETRY_REFUND')], ['QC_PASSED', 'FAILED', 'Your account does not have enough balance to carry out the refund operation.', true]);
  const refusedEntry = (await Payment.findById(refused.order.paymentId)).refunds.find((entry) => entry.key === `return:${refusedReturn.id}`);
  assert.deepEqual([refusedEntry.status, Boolean(refusedEntry.failureReason)], ['FAILED', true]);
  assert.equal((await adminPost(`/returns/${refusedReturn.id}/retry-refund`, {}, viewer)).status, 403);
  const stillRefused = await adminPost(`/returns/${refusedReturn.id}/retry-refund`, {}); // still refused: the reason is shown again, nothing is paid
  assert.deepEqual([stillRefused.status, stillRefused.body.meta.refund.status], [200, 'FAILED']);
  paymentGateway.refund = refundBeforeRefusal;
  const refundsBeforeRetry = refunds.length;
  const retriedRefund = await adminPost(`/returns/${refusedReturn.id}/retry-refund`, {});
  assert.deepEqual([retriedRefund.body.data.status, retriedRefund.body.meta.refund.status, retriedRefund.body.meta.refund.failureReason, refunds.length], ['CLOSED', 'COMPLETED', null, refundsBeforeRetry + 1]);
  assert.equal((await adminPost(`/returns/${refusedReturn.id}/retry-refund`, {})).status, 200); // again: nothing more is paid
  assert.ok(refundKeys.length > 0 && refundKeys.every((key) => /^[A-Za-z0-9_-]+$/.test(key)), refundKeys.join(',')); // Razorpay refuses a key with anything else (colons, commas)
  assert.equal(refunds.length, refundsBeforeRetry + 1);

  // ======================================================================= invoices: GSTIN, correction, credit notes, access
  await Offer.updateOne({ _id: mug }, { $inc: { stock: 10 } });
  const rawSeller = (sellerId, path, init = {}) => fetch(`http://127.0.0.1:${server.address().port}/api/seller/v1${path}`, { ...init, headers: { 'content-type': 'application/json', authorization: `Bearer ${signAccessToken({ sub: String(new mongoose.Types.ObjectId()), role: 'SELLER', sellerId })}` } });
  const taxOrder = await buyNow([{ offerId: mug, quantity: 1 }]);
  const taxParcel = String(taxOrder.order.subOrders[0]._id);
  await sellerCall(sellerA, 'POST', `/orders/${taxParcel}/confirm`);
  assert.equal((await sellerCall(sellerA, 'POST', `/orders/${taxParcel}/mock-ready-to-ship`)).status, 200);
  const bill = await Invoice.findOne({ subOrderId: taxParcel, docType: 'INVOICE' });
  assert.match(bill.number, /^[0-9A-Z]{4}\/\d{4}\/\d{5}$/);
  assert.ok(bill.number.length <= 16);
  assert.equal(bill.taxable, false);

  // the seller adds a GSTIN: only valid ones are accepted
  assert.equal((await sellerCall(sellerA, 'PUT', '/settings/gstin', { gstin: 'nope' })).status, 422);
  assert.equal((await sellerCall(sellerA, 'PUT', '/settings/gstin', { gstin: '24ABCDE1234F1Z5' })).status, 200);

  // an admin corrects the bill: a credit note cancels it and a new GST invoice (CGST+SGST: seller and buyer are both in Gujarat) follows
  assert.equal((await adminPost(`/invoices/${bill._id}/regenerate`, { reason: 'GSTIN added' }, viewer)).status, 403);
  assert.equal((await adminPost(`/invoices/${bill._id}/regenerate`, { reason: 'x' })).status, 422);
  const regenerated = await adminPost(`/invoices/${bill._id}/regenerate`, { reason: 'GSTIN added' });
  assert.equal(regenerated.status, 200, JSON.stringify(regenerated.body));
  const fresh = await Invoice.findById(regenerated.body.data.id).lean();
  const creditForBill = await Invoice.findOne({ refInvoiceId: bill._id }).lean();
  assert.equal((await Invoice.findById(bill._id).lean()).supersededBy.toString(), String(fresh._id));
  assert.deepEqual([fresh.taxable, fresh.intraState, fresh.totals.igstPaise > 0, fresh.totals.cgstPaise + fresh.totals.sgstPaise > 0], [true, true, false, true]);
  assert.equal(Number(fresh.number.slice(-5)), Number(bill.number.slice(-5)) + 1); // gapless
  assert.ok(creditForBill.number.startsWith('C') && creditForBill.number.length <= 16);
  assert.equal((await adminPost(`/invoices/${bill._id}/regenerate`, { reason: 'again' })).body.error.code, 'NOT_REGENERABLE');

  // cancelling the handed-over parcel (admin only) reverses what is live: the new invoice and Arise's fee invoice get credit notes
  const taxCancelled = await adminPost(`/orders/${taxOrder.order.number}/parcels/${taxParcel}/status`, { status: 'CANCELLED', reason: 'Fraud check failed' });
  assert.equal(taxCancelled.status, 200);
  const docs = await Invoice.find({ orderId: taxOrder.order._id }).lean();
  assert.deepEqual([docs.filter((d) => d.docType === 'INVOICE').length, docs.filter((d) => d.docType === 'CREDIT_NOTE').length], [3, 3]);
  assert.equal(docs.filter((d) => d.docType === 'CREDIT_NOTE' && d.kind === 'PLATFORM_FEE').length, 1);
  assert.equal((await adminPost(`/orders/${taxOrder.order.number}/parcels/${taxParcel}/status`, { status: 'ACCEPTED', reason: 'Reopen please' })).body.error.code, 'PARCEL_CANCELLED');
  assert.equal((await Invoice.countDocuments({ orderId: taxOrder.order._id })), 6); // asking again made no more

  // who can fetch what
  const customerDocs = (await call('GET', `/orders/${taxOrder.order._id}/invoices`)).body.data;
  assert.equal(customerDocs.length, 6);
  const local = (link) => { const url = new URL(link); return `http://127.0.0.1:${server.address().port}${url.pathname}${url.search}`; }; // the link carries PUBLIC_ORIGIN
  const viaLink = await fetch(local(customerDocs[0].downloadUrl));
  assert.equal(Buffer.from(await viaLink.arrayBuffer()).subarray(0, 5).toString(), '%PDF-');
  assert.equal((await fetch(local(customerDocs[0].downloadUrl).replace(/token=\d+/, 'token=1'))).status, 403);
  assert.equal((await fetch(local(customerDocs[0].downloadUrl).replace(customerDocs[0].id, customerDocs[1].id))).status, 403); // a link opens only its own document
  assert.ok((await sellerCall(sellerA, 'GET', `/orders/${taxParcel}`)).body.data.documents.some((d) => d.type === 'CREDIT_NOTE'));
  assert.equal((await rawSeller(sellerB, `/finance/invoices/${bill._id}/pdf`)).status, 404);
  assert.equal((await rawSeller(sellerA, `/finance/invoices/${bill._id}/pdf`)).status, 200);
  const sellerList = (await sellerCall(sellerA, 'GET', '/finance/invoices?type=CREDIT_NOTE')).body.data;
  assert.ok(sellerList.length >= 2 && sellerList.every((row) => row.type === 'CREDIT_NOTE' && row.sellerId === sellerA));
  assert.equal((await sellerCall(sellerB, 'GET', `/finance/invoices?q=${bill.number.replace('/', '%2F')}`)).body.data.length, 0);
  assert.equal((await adminCall('/invoices?type=CREDIT_NOTE', viewer)).status, 403);
  assert.ok((await adminCall('/invoices?type=CREDIT_NOTE')).body.data.length >= 3);
  assert.equal((await adminCall(`/orders/${taxOrder.order.number}`)).body.meta.invoices.length, 6);
  assert.deepEqual((await adminPost(`/invoices/${fresh._id}/resend`, {})).body.data, { sent: true });
  const printed = await rawSeller(sellerA, '/orders/invoices/print', { method: 'POST', body: JSON.stringify({ ids: [parcelId, mockedParcel] }) });
  assert.equal(Buffer.from(await printed.arrayBuffer()).subarray(0, 5).toString(), '%PDF-');
  assert.equal((await rawSeller(sellerB, '/orders/invoices/print', { method: 'POST', body: JSON.stringify({ ids: [parcelId] }) })).status, 404);
  // a parcel handed over before invoicing existed (delivered, no invoice) gets one when anyone asks, at any status after ready-to-ship
  await Invoice.deleteMany({ orderId: mocked.order._id });
  assert.equal((await rawSeller(sellerA, `/orders/${mockedParcel}/invoice`)).status, 200);
  assert.ok((await sellerCall(sellerA, 'GET', `/orders/${mockedParcel}`)).body.data.invoiceNo);
  await Invoice.deleteMany({ orderId: mocked.order._id });
  assert.equal((await call('GET', `/orders/${mocked.order._id}/invoices`)).body.data.filter((d) => d.type !== 'CREDIT_NOTE').length, 2); // goods + platform fee
  await Invoice.deleteMany({ orderId: mocked.order._id });
  assert.equal((await adminCall(`/orders/${mocked.order.number}`)).body.meta.invoices.length, 2);

  // ======================================================================= cash on delivery
  const { Shipment } = await import('../src/modules/shipping/public/index.js');
  await Offer.updateOne({ _id: mug }, { $inc: { stock: 10 } });
  const prepaidQuote = shippingGateway.quote;
  const quoted = [];
  let codServiceable = true;
  shippingGateway.quote = async ({ cod }) => { // the courier's cash-on-delivery rate is higher, and it may not collect cash everywhere
    quoted.push(Boolean(cod));
    return { serviceable: cod ? codServiceable : true, feePaise: cod ? 6_000 : 5_000, etaDays: 3 };
  };
  const codCheckout = async () => (await call('POST', '/checkout/sessions', { source: 'BUY_NOW', items: [{ offerId: mug, quantity: 1 }] })).body.data;

  // where no courier collects cash, COD is not offered and cannot be chosen
  codServiceable = false;
  const noCod = await codCheckout();
  assert.deepEqual([noCod.codEligible, noCod.allowedPaymentMethods.includes('cod')], [false, false]);
  assert.equal((await call('PATCH', `/checkout/sessions/${noCod.id}/payment-method`, { paymentMethod: 'cod' })).body.error.code, 'PAYMENT_METHOD_UNAVAILABLE');
  assert.equal((await call('POST', `/checkout/sessions/${noCod.id}/payment-intent`, { method: 'cod' })).body.error.code, 'PAYMENT_METHOD_UNAVAILABLE');
  codServiceable = true;

  // choosing it re-prices: the cash-on-delivery delivery rate plus the handling fee
  const cod1 = await codCheckout();
  assert.deepEqual([cod1.codEligible, cod1.allowedPaymentMethods.includes('cod'), cod1.totals.payablePaise], [true, true, 11_200 + 5_000 + 500]); // prepaid until chosen
  const chosen = (await call('PATCH', `/checkout/sessions/${cod1.id}/payment-method`, { paymentMethod: 'cod' })).body.data;
  assert.deepEqual([chosen.totals.deliveryFeePaise, chosen.totals.codFeePaise, chosen.totals.payablePaise], [6_000, 1_500, 11_200 + 6_000 + 500 + 1_500]);
  assert.equal((await call('PATCH', `/checkout/sessions/${cod1.id}/payment-method`, { paymentMethod: 'upi' })).body.data.totals.payablePaise, 11_200 + 5_000 + 500); // and back
  await call('PATCH', `/checkout/sessions/${cod1.id}/payment-method`, { paymentMethod: 'cod' });

  const razorpayOrders = await Payment.countDocuments({ provider: 'RAZORPAY' });
  const codIntent = await call('POST', `/checkout/sessions/${cod1.id}/payment-intent`, { method: 'cod' });
  assert.equal(codIntent.status, 201, JSON.stringify(codIntent.body));
  assert.deepEqual([codIntent.body.data.status, codIntent.body.data.method, codIntent.body.data.providerAction.type, codIntent.body.data.amountPaise], ['SUCCEEDED', 'cod', 'NONE', chosen.totals.payablePaise]);
  assert.equal(await Payment.countDocuments({ provider: 'RAZORPAY' }), razorpayOrders); // no gateway order, nothing to pay now
  assert.equal((await call('POST', `/checkout/sessions/${cod1.id}/payment-intent`, { method: 'cod' })).body.data.id, codIntent.body.data.id); // a retry reuses it
  assert.equal((await call('POST', `/checkout/sessions/${cod1.id}/revalidate`)).body.error.code, 'CHECKOUT_PAID'); // the checkout is committed
  assert.equal((await call('POST', `/payments/${codIntent.body.data.id}/confirm`, { razorpayPaymentId: 'pay_x', razorpayOrderId: `cod_${cod1.id}`, razorpaySignature: 'good' })).status, 422); // nothing to confirm online

  const codPlaced = await call('POST', '/orders', { checkoutSessionId: cod1.id, paymentId: codIntent.body.data.id });
  assert.equal(codPlaced.status, 201, JSON.stringify(codPlaced.body));
  const codOrder = codPlaced.body.data;
  assert.deepEqual([codOrder.paymentMethod, codOrder.paymentStatus, codOrder.amountPaise], ['cod', 'COD_PENDING', chosen.totals.payablePaise]);
  const codStored = await Order.findById(codOrder.id);
  assert.equal(codStored.subOrders[0].codDuePaise, chosen.totals.payablePaise); // one parcel: the courier collects everything, fees included
  assert.equal((await adminCall(`/orders/${codStored.number}`)).body.data.paymentStatus, 'PENDING');

  // cancelling before shipment: stock back, nothing to refund because nothing was paid
  const refundsBeforeCod = refunds.length;
  const stockBeforeCancel = (await stockOf(mug))[0];
  const codCancelled = await call('POST', `/orders/${codOrder.id}/cancel`, { reason: 'Changed my mind' });
  assert.equal(codCancelled.body.data.status, 'CANCELLED');
  assert.deepEqual([refunds.length, (await stockOf(mug))[0]], [refundsBeforeCod, stockBeforeCancel + 1]);
  assert.equal((await Order.findById(codOrder.id)).refundedPaise, 0);

  // shipping: Shiprocket is told to collect the whole amount; delivery makes it paid; fees are on Arise's invoice; no returns yet
  const shipped = [];
  const createShipment = shippingGateway.createShipment;
  shippingGateway.createShipment = async (args) => { shipped.push(args); return createShipment(args); };
  const cod2 = await codCheckout();
  await call('PATCH', `/checkout/sessions/${cod2.id}/payment-method`, { paymentMethod: 'cod' });
  const cod2Intent = (await call('POST', `/checkout/sessions/${cod2.id}/payment-intent`, { method: 'cod' })).body.data;
  const cod2Order = await Order.findById((await call('POST', '/orders', { checkoutSessionId: cod2.id, paymentId: cod2Intent.id })).body.data.id);
  const cod2Parcel = String(cod2Order.subOrders[0]._id);
  await sellerCall(sellerA, 'POST', `/orders/${cod2Parcel}/confirm`);
  assert.equal((await sellerCall(sellerA, 'POST', `/orders/${cod2Parcel}/ready-to-ship`)).status, 200);
  assert.equal(shipped.at(-1).collectPaise, cod2Order.totals.payablePaise);
  shippingGateway.createShipment = createShipment;
  const feeInvoice = await Invoice.findOne({ orderId: cod2Order._id, kind: 'PLATFORM_FEE' });
  assert.deepEqual([feeInvoice.lines.map((line) => line.description), feeInvoice.totals.totalPaise], [['Platform fee', 'Cash on delivery fee'], 500 + 1_500]);
  const cod2Awb = (await Shipment.findOne({ subOrderId: cod2Parcel })).awb;
  await track(cod2Awb, 'DELIVERED', '30 11 2026 12:00:00');
  const codDelivered = (await call('GET', `/orders/${cod2Order._id}`)).body.data;
  assert.deepEqual([codDelivered.status, codDelivered.paymentStatus, codDelivered.canReturn], ['DELIVERED', 'PAID', false]);
  assert.equal((await call('GET', `/orders/${cod2Order._id}/returnable-items`)).body.data.items[0].eligible, false);
  assert.equal((await adminCall(`/orders/${cod2Order.number}`)).body.data.paymentStatus, 'CAPTURED');

  // refused at the door: restocked and credited, but nothing is refunded because nothing was paid
  const cod3 = await codCheckout();
  await call('PATCH', `/checkout/sessions/${cod3.id}/payment-method`, { paymentMethod: 'cod' });
  const cod3Intent = (await call('POST', `/checkout/sessions/${cod3.id}/payment-intent`, { method: 'cod' })).body.data;
  const cod3Order = await Order.findById((await call('POST', '/orders', { checkoutSessionId: cod3.id, paymentId: cod3Intent.id })).body.data.id);
  const cod3Parcel = String(cod3Order.subOrders[0]._id);
  await sellerCall(sellerA, 'POST', `/orders/${cod3Parcel}/confirm`);
  const cod3Awb = (await sellerCall(sellerA, 'POST', `/orders/${cod3Parcel}/mock-ready-to-ship`)).body.data.awb;
  const stockBeforeCodRto = (await stockOf(mug))[0];
  const refundsBeforeCodRto = refunds.length;
  await track(cod3Awb, 'PICKED UP', '30 11 2026 09:00:00');
  await track(cod3Awb, 'RTO INITIATED', '01 12 2026 09:00:00');
  await track(cod3Awb, 'RTO DELIVERED', '04 12 2026 09:00:00');
  assert.equal((await sellerCall(sellerA, 'GET', `/orders/${cod3Parcel}`)).body.data.status, 'RTO_DELIVERED');
  assert.deepEqual([refunds.length, (await stockOf(mug))[0], (await Order.findById(cod3Order._id)).refundedPaise], [refundsBeforeCodRto, stockBeforeCodRto + 1, 0]);
  assert.ok(await Invoice.findOne({ subOrderId: cod3Parcel, docType: 'CREDIT_NOTE' }));
  shippingGateway.quote = prepaidQuote;
  assert.ok(quoted.includes(true) && quoted.includes(false));

  // ======================================================================= seller wallet and withdrawals
  const { SettlementLine } = await import('../src/modules/settlement/infrastructure/persistence/settlementLine.model.js');
  const { SellerWallet, WalletEntry, Withdrawal } = await import('../src/modules/settlement/infrastructure/persistence/wallet.model.js');
  const { PlatformSetting } = await import('../src/modules/admin/infrastructure/persistence/platformSetting.model.js');
  const { releaseDue, accrueMissing } = await import('../src/modules/settlement/public/index.js');
  const { verifyWallet } = await import('../src/modules/settlement/application/wallet.service.js');

  const sellerC = await seller('Wallet C', '380015');
  const kettle = await listed('Wallet Kettle', sellerC, 20, 20_000);
  await Seller.updateOne({ _id: sellerC }, { $set: { bankOk: true, pan: 'ABCDE1234F', bank: { accountHolder: 'Wallet C', accountNumber: '1234567890', ifsc: 'HDFC0001234', bankName: 'HDFC' }, approvedAt: new Date(Date.now() - 200 * 86_400_000) } });
  await PlatformSetting.updateOne({ key: 'settlement' }, { $set: { values: { minWithdrawalPaise: 1_000 } } }, { upsert: true }); // the admin's limit: ₹10 minimum
  const walletOf = async () => (await sellerCall(sellerC, 'GET', '/finance/wallet')).body.data;
  const deliverKettle = async (method) => {
    const checkout = (await call('POST', '/checkout/sessions', { source: 'BUY_NOW', items: [{ offerId: kettle, quantity: 1 }] })).body.data;
    if (method === 'cod') await call('PATCH', `/checkout/sessions/${checkout.id}/payment-method`, { paymentMethod: 'cod' });
    const intent = (await call('POST', `/checkout/sessions/${checkout.id}/payment-intent`, { method })).body.data;
    if (method === 'cod') await call('POST', '/orders', { checkoutSessionId: checkout.id, paymentId: intent.id });
    else await capture(await Payment.findById(intent.id));
    const order = await Order.findOne({ checkoutSessionId: checkout.id });
    const parcel = String(order.subOrders[0]._id);
    await sellerCall(sellerC, 'POST', `/orders/${parcel}/confirm`);
    const awb = (await sellerCall(sellerC, 'POST', `/orders/${parcel}/mock-ready-to-ship`)).body.data.awb;
    await track(awb, 'DELIVERED', '02 12 2026 12:00:00');
    return order;
  };

  // delivery credits the wallet as pending: 20000 - commission 2000 - GST on it 360 - TCS 89 - TDS 18
  const kettleOrder = await deliverKettle('upi');
  const kettleLine = await SettlementLine.findOne({ sellerId: sellerC });
  assert.deepEqual([kettleLine.salePaise, kettleLine.commissionPaise, kettleLine.gstOnFeesPaise, kettleLine.tcsPaise, kettleLine.tdsPaise, kettleLine.netPaise], [20_000, 2_000, 360, 89, 18, 17_533]);
  assert.deepEqual([(await walletOf()).pendingPaise, (await walletOf()).availablePaise], [17_533, 0]);
  assert.equal(await accrueMissing(), 0); // the sweep makes no w_second line
  assert.equal(await SettlementLine.countDocuments({ sellerId: sellerC }), 1);
  assert.equal((await verifyWallet(sellerC)).ok, true);

  // nothing is released while the return window runs; then the money becomes available, once
  assert.equal(await releaseDue(), 0);
  const codOrder2 = await deliverKettle('cod'); // cash on delivery: waits for the courier's cash even after its window
  const codLine = await SettlementLine.findOne({ orderId: codOrder2._id });
  assert.equal(codLine.codPending, true);
  await SettlementLine.updateMany({ sellerId: sellerC }, { $set: { releaseAt: new Date(Date.now() - 1_000) } });
  assert.equal(await releaseDue(), 1);
  assert.equal(await releaseDue(), 0);
  let w_wallet = await walletOf();
  assert.deepEqual([w_wallet.pendingPaise, w_wallet.availablePaise, w_wallet.withdrawablePaise], [17_533, 17_533, 17_533]);
  const mineList = (await sellerCall(sellerC, 'GET', '/settlements/mine')).body;
  assert.deepEqual(mineList.data.map((row) => row.state).sort(), ['AVAILABLE', 'HELD']);
  assert.equal(mineList.data.find((row) => row.state === 'HELD').holdReason.startsWith('Cash on delivery'), true);
  assert.equal((await sellerCall(sellerB, 'GET', `/settlements/${mineList.data[0].id}`)).status, 404); // another seller cannot read it

  // withdrawing: the admin's limits and the balance decide; the amount is locked at once
  assert.equal((await sellerCall(sellerC, 'POST', '/finance/withdrawals', { amountPaise: 500 })).body.error.code, 'BELOW_MINIMUM');
  assert.equal((await sellerCall(sellerC, 'POST', '/finance/withdrawals', { amountPaise: 20_000 })).body.error.code, 'INSUFFICIENT_BALANCE');
  const w_first = await sellerCall(sellerC, 'POST', '/finance/withdrawals', { amountPaise: 10_000 });
  assert.equal(w_first.status, 201, JSON.stringify(w_first.body));
  assert.deepEqual([w_first.body.data.status, w_first.body.data.bank.maskedAccount, w_first.body.data.number.startsWith('WD-')], ['REQUESTED', '••7890', true]);
  w_wallet = await walletOf();
  assert.deepEqual([w_wallet.availablePaise, w_wallet.lockedPaise, w_wallet.openWithdrawals], [7_533, 10_000, 1]);
  assert.equal((await sellerCall(sellerC, 'POST', '/finance/withdrawals', { amountPaise: 2_000 })).body.error.code, 'TOO_MANY_OPEN');
  // the seller may take it back until it is w_approved
  assert.equal((await sellerCall(sellerC, 'POST', `/finance/withdrawals/${w_first.body.data.id}/cancel`)).body.data.status, 'CANCELLED');
  assert.equal((await sellerCall(sellerC, 'POST', `/finance/withdrawals/${w_first.body.data.id}/cancel`)).body.error.code, 'WITHDRAWAL_NOT_ACTIONABLE');
  w_wallet = await walletOf();
  assert.deepEqual([w_wallet.availablePaise, w_wallet.lockedPaise], [17_533, 0]);

  // a payout hold stops requests; releasing it lets them through
  assert.equal((await adminPost(`/seller-wallets/${sellerC}/payout-hold`, { onHold: true, reason: 'Under review' })).status, 200);
  assert.equal((await sellerCall(sellerC, 'POST', '/finance/withdrawals', { amountPaise: 10_000 })).body.error.code, 'PAYOUT_ON_HOLD');
  await adminPost(`/seller-wallets/${sellerC}/payout-hold`, { onHold: false, reason: 'Review finished' });

  // every request is w_approved by hand, then w_paid with the bank transaction number
  const w_second = (await sellerCall(sellerC, 'POST', '/finance/withdrawals', { amountPaise: 10_000 })).body.data;
  assert.equal((await adminPost(`/withdrawals/${w_second.id}/pay`, { txnNo: 'UTR000111222' })).body.error.code, 'WITHDRAWAL_NOT_ACTIONABLE'); // approve w_first
  assert.equal((await adminPost(`/withdrawals/${w_second.id}/approve`, {}, viewer)).status, 403);
  const w_approved = (await adminPost(`/withdrawals/${w_second.id}/approve`, {})).body.data;
  assert.deepEqual([w_approved.status, w_approved.allowedActions], ['APPROVED', ['PAY', 'REJECT']]);
  assert.equal((await sellerCall(sellerC, 'POST', `/finance/withdrawals/${w_second.id}/cancel`)).body.error.code, 'WITHDRAWAL_NOT_ACTIONABLE'); // too late to cancel
  assert.equal((await adminPost(`/withdrawals/${w_second.id}/pay`, { txnNo: 'x' })).status, 422);
  const w_paid = await adminPost(`/withdrawals/${w_second.id}/pay`, { txnNo: 'UTR000111222' });
  assert.deepEqual([w_paid.body.data.status, w_paid.body.data.txnNo], ['PAID', 'UTR000111222']);
  assert.equal((await adminPost(`/withdrawals/${w_second.id}/pay`, { txnNo: 'UTR000111222' })).body.error.code, 'WITHDRAWAL_NOT_ACTIONABLE'); // paying twice changes nothing
  w_wallet = await walletOf();
  assert.deepEqual([w_wallet.availablePaise, w_wallet.lockedPaise, w_wallet.lifetimeWithdrawnPaise], [7_533, 0, 10_000]);
  assert.equal((await verifyWallet(sellerC)).ok, true);

  // a rejection gives the money back with the reason
  const w_third = (await sellerCall(sellerC, 'POST', '/finance/withdrawals', { amountPaise: 5_000 })).body.data;
  assert.equal((await adminPost(`/withdrawals/${w_third.id}/reject`, { reason: 'Bank name mismatch' })).body.data.status, 'REJECTED');
  assert.deepEqual([(await walletOf()).availablePaise, (await walletOf()).lockedPaise], [7_533, 0]);
  assert.equal((await sellerCall(sellerC, 'GET', `/finance/withdrawals/${w_third.id}`)).body.data.decisionReason, 'Bank name mismatch');
  assert.equal((await sellerCall(sellerC, 'GET', '/finance/withdrawals?status=PAID')).body.data.length, 1);

  // a new seller keeps a reserve of what is available
  await Seller.updateOne({ _id: sellerC }, { $set: { approvedAt: new Date() } });
  assert.equal((await walletOf()).reservePaise, 754); // 10% of 7533, rounded up (Settings > Seller policies)
  await Seller.updateOne({ _id: sellerC }, { $set: { approvedAt: new Date(Date.now() - 200 * 86_400_000) } });

  // returns: the seller's wallet must be able to give back released money (7533 available < 17533 to return)
  const keptAddress = String((await AddressBook.findOne({ customerId: alice })).addresses[0]._id);
  const w_asked = { orderId: String(kettleOrder._id), orderItemId: String(kettleOrder.subOrders[0].items[0]._id), resolution: 'REFUND', reasonCode: 'CHANGED_MIND', pickupAddressId: keptAddress };
  assert.equal((await call('POST', '/returns', w_asked)).body.error.code, 'RETURN_UNAVAILABLE');
  assert.equal((await adminPost(`/seller-wallets/${sellerC}/adjustments`, { amountPaise: 20_000, reason: 'Goodwill credit' })).body.data.availablePaise, 27_533);
  const w_wanted = await call('POST', '/returns', w_asked);
  assert.equal(w_wanted.status, 201, JSON.stringify(w_wanted.body));
  const w_returnId = w_wanted.body.data.id;
  await sellerCall(sellerC, 'POST', `/returns/${w_returnId}/approve`);
  await sellerCall(sellerC, 'POST', `/returns/${w_returnId}/receive`);
  assert.equal((await SettlementLine.findById(kettleLine._id)).reversedAt, null); // taken back only once the refund is made
  assert.equal((await sellerCall(sellerC, 'POST', `/returns/${w_returnId}/qc`, { result: 'PASS' })).status, 200);
  assert.notEqual((await SettlementLine.findById(kettleLine._id)).reversedAt, null);
  w_wallet = await walletOf();
  assert.deepEqual([w_wallet.availablePaise, w_wallet.pendingPaise], [10_000, 17_533]); // 27533 - 17533 given back
  assert.equal((await verifyWallet(sellerC)).ok, true);

  // cash on delivery is released only after the courier's cash is recorded as received
  assert.equal((await adminPost('/settlements/cod-remitted', { lineIds: [String(codLine._id)] })).body.data.marked, 1);
  assert.equal(await releaseDue(), 1);
  w_wallet = await walletOf();
  assert.deepEqual([w_wallet.availablePaise, w_wallet.pendingPaise], [27_533, 0]);
  assert.equal((await verifyWallet(sellerC)).ok, true);

  // what the admin sees
  const w_summary = (await adminCall('/settlements/summary')).body.data;
  assert.ok(w_summary.availablePaise >= 27_533 && w_summary.owedToSellersPaise >= w_summary.availablePaise);
  assert.equal((await adminCall(`/settlements?sellerId=${sellerC}`)).body.data.length, 2);
  assert.equal((await adminCall('/withdrawals?status=PAID')).body.data.some((row) => row.number === w_second.number), true);
  assert.equal((await adminCall(`/seller-wallets/${sellerC}/transactions`)).body.data.some((entry) => entry.type === 'WITHDRAWAL_PAID'), true);
  assert.equal((await adminPost(`/seller-wallets/${sellerC}/adjustments`, { amountPaise: 100, reason: 'try' }, viewer)).status, 403);
});
