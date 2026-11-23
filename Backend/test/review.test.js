// Customer reviews: the pure rules, then (with TEST_MONGODB_URI) the whole flow over HTTP against a real MongoDB.
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
  UPLOAD_DIR: mkdtempSync(join(tmpdir(), 'arise-review-')),
});
process.on('exit', () => rmSync(process.env.UPLOAD_DIR, { recursive: true, force: true }));

const { averageOf, classifyReview, moderate, reviewState, summaryChange } = await import('../src/modules/review/domain/services/reviewRules.js');

test('review rules: clean text publishes, flagged text or photos wait, only delivered unrefunded items can be reviewed', () => {
  assert.equal(classifyReview('Good quality fabric, fits true to size.'), 'CLEAN');
  assert.equal(classifyReview('Call me on 9876543210 for more'), 'PII');
  assert.equal(classifyReview('check out my channel www.example.com'), 'SPAM');
  assert.equal(classifyReview('they sent me this to review'), 'INCENTIVISED');
  assert.equal(classifyReview('this is a scam of a product'), 'PROFANITY');
  assert.equal(moderate({ body: 'Works great, would buy again.', mediaCount: 0 }).status, 'PUBLISHED');
  assert.equal(moderate({ body: 'Works great, would buy again.', mediaCount: 1 }).status, 'PENDING');
  assert.equal(moderate({ body: 'visit my page www.x.com', mediaCount: 0 }).status, 'PENDING');

  assert.equal(reviewState({ subStatus: 'DELIVERED', refunded: false, existingReviewId: null }).eligible, true);
  assert.equal(reviewState({ subStatus: 'SHIPPED', refunded: false, existingReviewId: null }).eligible, false);
  assert.equal(reviewState({ subStatus: 'DELIVERED', refunded: true, existingReviewId: null }).eligible, false);
  assert.match(reviewState({ subStatus: 'DELIVERED', refunded: false, existingReviewId: 'r1' }).reason, /already/);
});

test('review rules: a rating moves by exactly the difference between before and after', () => {
  const review = (status, rating) => ({ status, rating });
  assert.deepEqual(summaryChange(null, review('PUBLISHED', 4)), { count: 1, sum: 4, s4: 1 });
  assert.equal(summaryChange(null, review('PENDING', 4)), null);
  assert.deepEqual(summaryChange(review('PUBLISHED', 4), review('PUBLISHED', 2)), { count: 0, sum: -2, s4: -1, s2: 1 });
  assert.deepEqual(summaryChange(review('PUBLISHED', 5), review('REJECTED', 5)), { count: -1, sum: -5, s5: -1 });
  assert.deepEqual(summaryChange(review('PUBLISHED', 3), null), { count: -1, sum: -3, s3: -1 });
  assert.equal(summaryChange(review('PUBLISHED', 3), review('PUBLISHED', 3)), null);
  assert.equal(averageOf({ count: 3, sum: 13 }), 4.3);
  assert.equal(averageOf({ count: 0, sum: 0 }), null);
});

const uri = process.env.TEST_MONGODB_URI;
const opts = { skip: !uri && 'set TEST_MONGODB_URI to run' };

before(async () => { if (uri) await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000, autoIndex: true }); });
after(async () => {
  if (uri) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});

test('reviews: eligibility, auto-publish, moderation, rating totals, refund block and delete', opts, async (t) => {
  const { createApp } = await import('../src/app/app.js');
  const { signAccessToken } = await import('../src/shared/utils/jwt.js');
  const { User } = await import('../src/modules/identity/infrastructure/persistence/user.model.js');
  const { Order, Return } = await import('../src/modules/order/public/index.js');
  const { Review } = await import('../src/modules/review/infrastructure/persistence/review.model.js');
  const { ReviewSummary } = await import('../src/modules/review/infrastructure/persistence/reviewSummary.model.js');
  const { getRatingSummaries } = await import('../src/modules/review/public/index.js');
  await Promise.all([User.init(), Order.init(), Review.init(), ReviewSummary.init()]);

  const server = createServer(createApp()).listen(0);
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}/api`;

  const customer = await User.create({ role: 'CUSTOMER', name: 'Asha Rao', email: 'asha@arise.test', passwordHash: 'x', status: 'ACTIVE' });
  const admin = await User.create({ role: 'ADMIN', email: 'admin@arise.test', passwordHash: 'x', status: 'ACTIVE', permissions: ['*'] });
  const me = String(customer._id);
  const sellerId = String(new mongoose.Types.ObjectId());
  const call = async (token, method, path, body) => {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: await response.json() };
  };
  const asCustomer = (...args) => call(signAccessToken({ sub: me, role: 'CUSTOMER' }), ...args);
  const asAdmin = (...args) => call(signAccessToken({ sub: String(admin._id), role: 'ADMIN' }), ...args);

  const oid = () => new mongoose.Types.ObjectId();
  const line = (name) => ({ _id: oid(), productId: String(oid()), name, imageUrl: 'http://localhost/img.jpg', variantLabel: 'M', quantity: 1 });
  const [shirt, mug, lamp] = [line('Shirt'), line('Mug'), line('Lamp')];
  const sub = (status, items) => ({ _id: oid(), sellerId, status, items, deliveredAt: status === 'DELIVERED' ? new Date() : null, events: [] });
  const placed = await Order.create({
    number: 'ORD1', customerId: me, checkoutSessionId: oid(), paymentId: oid(), paymentMethod: 'upi',
    address: { city: 'Pune' }, totals: { payablePaise: 1000 }, subOrders: [sub('DELIVERED', [shirt, mug]), sub('SHIPPED', [lamp])],
  });
  const ratingOf = async (item) => (await getRatingSummaries([item.productId])).get(item.productId) ?? null;
  const publicReviews = async (item) => (await call(null, 'GET', `/customer/v1/products/${item.productId}/reviews`)).body.data;
  const write = (item, extra = {}) => asCustomer('POST', '/customer/v1/reviews', { orderItemId: String(item._id), rating: 5, body: 'Fits true to size and arrived on time.', ...extra });

  // not delivered yet -> cannot review; unknown item -> 404; too-short text -> 422
  const lampState = (await asCustomer('GET', `/customer/v1/order-items/${lamp._id}/review-eligibility`)).body.data;
  assert.deepEqual([lampState.eligible, lampState.reason], [false, 'Reviews are available after delivery.']);
  assert.equal((await write(lamp)).body.error.code, 'REVIEW_NOT_ELIGIBLE');
  assert.equal((await asCustomer('GET', `/customer/v1/order-items/${oid()}/review-eligibility`)).body.error.code, 'ORDER_ITEM_NOT_FOUND');
  assert.equal((await write(shirt, { body: 'short' })).status, 422);
  assert.equal((await call(signAccessToken({ sub: String(oid()), role: 'CUSTOMER' }), 'GET', `/customer/v1/order-items/${shirt._id}/review-eligibility`)).status, 404, 'not their order');

  // a clean text-only review publishes at once and counts toward the rating
  const created = await write(shirt, { title: 'Great', productId: 'ignored' });
  assert.equal(created.status, 201);
  const review = created.body.data;
  assert.deepEqual([review.moderationStatus, review.authorDisplayName, review.verifiedPurchase, review.allowedActions], ['PUBLISHED', 'Asha Rao', true, ['EDIT', 'DELETE']]);
  assert.deepEqual(await ratingOf(shirt), { rating: 5, ratingCount: 1 });
  const listed = await publicReviews(shirt);
  assert.deepEqual([listed.items.length, listed.summary.average, listed.summary.count, listed.items[0].allowedActions], [1, 5, 1, []]);
  assert.equal((await write(shirt)).body.error.code, 'REVIEW_ALREADY_EXISTS');
  assert.equal((await asCustomer('GET', `/customer/v1/order-items/${shirt._id}/review-eligibility`)).body.data.existingReviewId, review.id);

  // editing into something that needs a look pulls it out of the rating until an admin approves it
  const edited = await asCustomer('PATCH', `/customer/v1/reviews/${review.id}`, { rating: 3, title: '', body: 'Details at www.example.com please' });
  assert.equal(edited.body.data.moderationStatus, 'PENDING');
  assert.equal(await ratingOf(shirt), null);
  assert.equal((await publicReviews(shirt)).items.length, 0);
  const queue = await asAdmin('GET', '/admin/v1/reviews?status=PENDING');
  assert.deepEqual([queue.body.data.length, queue.body.data[0].certifiedBuyer, queue.body.data[0].autoModeration, queue.body.meta.facets.status.PENDING], [1, true, 'SPAM', 1]);
  assert.equal((await call(signAccessToken({ sub: me, role: 'CUSTOMER' }), 'GET', '/admin/v1/reviews')).status, 403);
  assert.equal((await asAdmin('POST', `/admin/v1/reviews/${review.id}/reject`, {})).status, 422, 'a reason is required');
  assert.equal((await asAdmin('POST', `/admin/v1/reviews/${review.id}/publish`)).body.data.status, 'PUBLISHED');
  assert.deepEqual(await ratingOf(shirt), { rating: 3, ratingCount: 1 });
  assert.equal((await asAdmin('POST', `/admin/v1/reviews/${review.id}/publish`)).body.error.code, 'NO_CHANGE');

  // rejecting removes it from the rating; the customer sees why
  assert.equal((await asAdmin('POST', `/admin/v1/reviews/${review.id}/reject`, { reason: 'Contains a link' })).body.data.status, 'REJECTED');
  assert.equal(await ratingOf(shirt), null);
  const mine = (await asCustomer('GET', '/customer/v1/reviews/mine')).body.data;
  assert.deepEqual([mine.items[0].moderationStatus, mine.items[0].rejectionReason], ['REJECTED', 'Contains a link']);

  // a review with photos waits for an admin even when its text is clean; photos must be the customer's own uploads
  assert.equal((await write(mug, { mediaIds: [`public/reviews/${oid()}/a.jpg`] })).body.error.code, 'MEDIA_INVALID');
  const withPhoto = (await write(mug, { rating: 4, mediaIds: [`public/reviews/${me}/a.jpg`] })).body.data;
  assert.deepEqual([withPhoto.moderationStatus, withPhoto.media.length], ['PENDING', 1]);
  assert.equal(await ratingOf(mug), null);
  const bulk = await asAdmin('POST', '/admin/v1/reviews/bulk', { action: 'PUBLISH_CLEAN', reviewIds: [withPhoto.id, review.id] });
  assert.equal(bulk.body.data.affected, 1, 'only the pending clean review is published; the rejected one is left alone');
  assert.deepEqual(await ratingOf(mug), { rating: 4, ratingCount: 1 });
  assert.equal((await asAdmin('POST', `/admin/v1/reviews/${withPhoto.id}/hide-media`)).body.data.mediaCount, 0);

  // deleting frees the item for a new review and takes the rating back
  assert.equal((await asCustomer('DELETE', `/customer/v1/reviews/${withPhoto.id}`)).body.data.deleted, true);
  assert.equal(await ratingOf(mug), null);
  assert.equal((await asCustomer('GET', `/customer/v1/order-items/${mug._id}/review-eligibility`)).body.data.eligible, true);

  // a refunded item can no longer be reviewed
  const returned = placed.subOrders[0];
  await Return.create({
    number: 'RET1', orderId: placed._id, subOrderId: returned._id, itemId: mug._id, orderNumber: 'ORD1', productName: 'Mug', customerId: me, sellerId,
    reasonCode: 'DAMAGED', faultAttribution: 'SELLER', pickupAddress: { id: 'a' }, amountPaise: 500, status: 'REFUND_COMPLETED', decisionDueAt: new Date(),
  });
  const refunded = (await asCustomer('GET', `/customer/v1/order-items/${mug._id}/review-eligibility`)).body.data;
  assert.equal(refunded.eligible, false);
  assert.match(refunded.reason, /refunded/);
  assert.equal((await write(mug)).body.error.code, 'REVIEW_NOT_ELIGIBLE');

  // the order tells the app which items can still be rated
  const items = (await asCustomer('GET', `/customer/v1/orders/${placed._id}`)).body.data.items;
  const flags = (item) => items.find((row) => row.id === String(item._id));
  assert.deepEqual([flags(shirt).canReview, flags(shirt).reviewId], [false, review.id]);
  assert.equal(flags(mug).canReview, false, 'refunded');
  assert.equal(flags(lamp).canReview, false, 'not delivered');

  // a total that drifted (say, a crash between saving a review and counting it) is put right by the rebuild
  const { rebuildRatingSummaries, deleteCustomerReviews } = await import('../src/modules/review/public/index.js');
  await ReviewSummary.updateOne({ productId: shirt.productId }, { $set: { count: 9, sum: 45, s5: 9 } });
  assert.equal((await ratingOf(shirt)).ratingCount, 9);
  assert.equal(await rebuildRatingSummaries(), 1);
  assert.equal(await ratingOf(shirt), null, 'the only review is rejected, so nothing counts');
  assert.equal(await rebuildRatingSummaries(), 0, 'nothing left to correct');

  // sellers see only their own published reviews (buyer masked), answer them publicly and report abuse
  await asAdmin('POST', `/admin/v1/reviews/${review.id}/publish`);
  assert.deepEqual(await ratingOf(shirt), { rating: 3, ratingCount: 1 });
  const asSeller = (id, ...args) => call(signAccessToken({ sub: String(oid()), role: 'SELLER', sellerId: id }), ...args);
  const mineList = (await asSeller(sellerId, 'GET', '/seller/v1/customer-experience/reviews')).body.data;
  assert.deepEqual([mineList.length, mineList[0].customerName, mineList[0].sellerReply], [1, 'Verified buyer', null]);
  const stranger = String(oid());
  assert.equal((await asSeller(stranger, 'GET', '/seller/v1/customer-experience/reviews')).body.data.length, 0);
  assert.equal((await asSeller(stranger, 'POST', `/seller/v1/customer-experience/reviews/${review.id}/reply`, { text: 'Thanks for your feedback' })).status, 404);
  const replyPath = `/seller/v1/customer-experience/reviews/${review.id}/reply`;
  assert.equal((await asSeller(sellerId, 'POST', replyPath, { text: 'Call me on 9876543210' })).body.error.code, 'PROHIBITED_CONTENT');
  assert.equal((await asSeller(sellerId, 'POST', replyPath, { text: 'Thank you, glad it fits!' })).body.data.sellerReply.status, 'PENDING');
  assert.equal((await asSeller(sellerId, 'POST', replyPath, { text: 'Another reply here' })).body.error.code, 'REPLY_EXISTS');
  assert.equal((await publicReviews(shirt)).items[0].sellerReply, null, 'a pending reply is not public');
  const moderateReply = (body) => asAdmin('POST', `/admin/v1/reviews/${review.id}/reply/moderate`, body);
  assert.equal((await moderateReply({ status: 'REJECTED' })).status, 422);
  assert.equal((await moderateReply({ status: 'REJECTED', reason: 'Not helpful' })).body.data.sellerReply.status, 'REJECTED');
  assert.equal((await moderateReply({ status: 'PUBLISHED' })).body.error.code, 'NO_PENDING_REPLY');
  assert.equal((await asSeller(sellerId, 'POST', replyPath, { text: 'Thanks, happy to help!' })).status, 200, 'a rejected reply may be replaced');
  assert.equal((await moderateReply({ status: 'PUBLISHED' })).body.data.sellerReply.status, 'PUBLISHED');
  assert.equal((await publicReviews(shirt)).items[0].sellerReply.text, 'Thanks, happy to help!');

  const reportPath = `/seller/v1/customer-experience/reviews/${review.id}/report`;
  const reported = await asSeller(sellerId, 'POST', reportPath, { reason: 'Review is about a different product' });
  assert.deepEqual([reported.status, reported.body.data.status], [201, 'OPEN']);
  assert.equal((await asSeller(sellerId, 'POST', reportPath, { reason: 'again' })).body.error.code, 'REPORT_EXISTS');
  const open = await asAdmin('GET', '/admin/v1/abuse-reports?status=OPEN');
  assert.deepEqual([open.body.data.length, open.body.meta.facets.status.OPEN], [1, 1]);
  const decide = (body) => asAdmin('POST', `/admin/v1/abuse-reports/${reported.body.data.id}/decide`, body);
  assert.equal((await decide({ decision: 'MAYBE' })).status, 422);
  assert.equal((await decide({ decision: 'REMOVED', reason: 'Off topic' })).body.data.status, 'REMOVED');
  assert.equal(await ratingOf(shirt), null, 'a removed review leaves the rating');
  assert.equal((await decide({ decision: 'DISMISSED' })).body.error.code, 'ALREADY_DECIDED');
  assert.equal((await asSeller(sellerId, 'GET', '/seller/v1/customer-experience/reviews')).body.data.length, 0);

  // deleting the account deletes their reviews and takes their ratings back
  await asAdmin('POST', `/admin/v1/reviews/${review.id}/publish`);
  assert.deepEqual(await ratingOf(shirt), { rating: 3, ratingCount: 1 });

  // other customers can mark a review helpful (once) and report it; the author can do neither on their own review
  const other = signAccessToken({ sub: String(oid()), role: 'CUSTOMER' });
  const helpfulPath = `/customer/v1/reviews/${review.id}/helpful`;
  assert.equal((await asCustomer('PUT', helpfulPath)).body.error.code, 'CANNOT_VOTE_OWN');
  assert.deepEqual((await call(other, 'PUT', helpfulPath)).body.data, { id: review.id, helpfulCount: 1, viewerFoundHelpful: true });
  assert.equal((await call(other, 'PUT', helpfulPath)).body.data.helpfulCount, 1, 'a second vote does not count');
  const seen = (await call(other, 'GET', `/customer/v1/products/${shirt.productId}/reviews`)).body.data.items[0];
  assert.deepEqual([seen.helpfulCount, seen.viewerFoundHelpful], [1, true]);
  assert.equal((await call(other, 'DELETE', helpfulPath)).body.data.helpfulCount, 0);
  const reportReview = (token, reason = 'This is fake') => call(token, 'POST', `/customer/v1/reviews/${review.id}/report`, { reason });
  assert.equal((await reportReview(signAccessToken({ sub: me, role: 'CUSTOMER' }))).body.error.code, 'CANNOT_REPORT_OWN');
  assert.equal((await reportReview(other)).status, 201);
  assert.equal((await reportReview(other)).body.error.code, 'REPORT_EXISTS');
  const flagged = (await asAdmin('GET', '/admin/v1/abuse-reports?status=OPEN')).body.data;
  assert.deepEqual([flagged.length, flagged[0].reporterType, flagged[0].sellerId], [1, 'CUSTOMER', null]);
  assert.equal((await asAdmin('POST', `/admin/v1/abuse-reports/${flagged[0].id}/decide`, { decision: 'DISMISSED' })).body.data.status, 'DISMISSED');

  assert.equal(await deleteCustomerReviews(me), 1);
  assert.equal(await ratingOf(shirt), null);
  assert.equal(await Review.countDocuments({ customerId: me }), 0);
});

test('questions: asking, seller and customer answers, moderation, helpful votes and rate-your-purchase reminders', opts, async (t) => {
  const { createApp } = await import('../src/app/app.js');
  const { signAccessToken } = await import('../src/shared/utils/jwt.js');
  const { User } = await import('../src/modules/identity/infrastructure/persistence/user.model.js');
  const { Product } = await import('../src/modules/product/infrastructure/persistence/product.model.js');
  const { Offer } = await import('../src/modules/product/infrastructure/persistence/offer.model.js');
  const { Order } = await import('../src/modules/order/public/index.js');
  const { Notification } = await import('../src/modules/notification/infrastructure/persistence/notification.model.js');
  const { sendReviewReminders } = await import('../src/modules/review/public/index.js');
  await Promise.all([User.init(), Product.init(), Offer.init(), Order.init(), Notification.init()]);

  const server = createServer(createApp()).listen(0);
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const oid = () => new mongoose.Types.ObjectId();
  const call = async (token, method, path, body) => {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: await response.json() };
  };

  const asker = await User.create({ role: 'CUSTOMER', name: 'Meera Nair', email: 'meera@arise.test', passwordHash: 'x', status: 'ACTIVE' });
  const helper = await User.create({ role: 'CUSTOMER', name: 'Ravi Menon', email: 'ravi@arise.test', passwordHash: 'x', status: 'ACTIVE' });
  const admin = await User.create({ role: 'ADMIN', email: 'qa-admin@arise.test', passwordHash: 'x', status: 'ACTIVE', permissions: ['*'] });
  const sellerId = String(oid());
  const lateSellerId = String(oid());
  const tokens = {
    asker: signAccessToken({ sub: String(asker._id), role: 'CUSTOMER' }),
    helper: signAccessToken({ sub: String(helper._id), role: 'CUSTOMER' }),
    admin: signAccessToken({ sub: String(admin._id), role: 'ADMIN' }),
    seller: signAccessToken({ sub: String(oid()), role: 'SELLER', sellerId }),
    stranger: signAccessToken({ sub: String(oid()), role: 'SELLER', sellerId: lateSellerId }),
  };
  const category = oid();
  const product = await Product.create({ title: 'Trail Jacket', categoryId: category, rootCategoryId: category, createdBySellerId: sellerId, status: 'LIVE' });
  await Offer.create({ productId: product._id, variantId: oid(), sellerId, sellingPricePaise: 1000, mrpPaise: 1200, status: 'LIVE' });
  const draft = await Product.create({ title: 'Hidden', categoryId: category, rootCategoryId: category, createdBySellerId: sellerId, status: 'QC_PENDING' });
  const pid = String(product._id);

  // asking: validated, only about live products, clean text goes public at once
  assert.equal((await call(tokens.asker, 'POST', '/customer/v1/questions', { productId: pid, body: 'hey' })).status, 422);
  assert.equal((await call(tokens.asker, 'POST', '/customer/v1/questions', { productId: String(draft._id), body: 'Is this waterproof?' })).status, 404);
  const asked = await call(tokens.asker, 'POST', '/customer/v1/questions', { productId: pid, body: 'Is this waterproof?' });
  assert.deepEqual([asked.status, asked.body.data.moderationStatus, asked.body.data.authorDisplayName, asked.body.data.answers], [201, 'PUBLISHED', 'Meera Nair', []]);
  const qid = asked.body.data.id;
  assert.equal((await call(null, 'GET', `/customer/v1/products/${pid}/questions`)).body.data.items.length, 1);
  const sellerBell = await Notification.findOne({ recipientType: 'SELLER', recipientId: sellerId });
  assert.equal(sellerBell.title, 'New customer question');

  // the seller sees it (buyer masked), answers it, and the answer waits for an admin
  const sellerQs = (await call(tokens.seller, 'GET', '/seller/v1/customer-experience/questions')).body.data;
  assert.deepEqual([sellerQs.length, sellerQs[0].customerName, sellerQs[0].slaBreached, sellerQs[0].customerId], [1, 'Buyer', false, undefined]);
  assert.equal((await call(tokens.stranger, 'GET', '/seller/v1/customer-experience/questions')).body.data.length, 0);
  const answerPath = `/seller/v1/customer-experience/questions/${qid}/answers`;
  assert.equal((await call(tokens.stranger, 'POST', answerPath, { text: 'Yes it is waterproof' })).status, 404);
  // a seller who starts selling the product later sees its older questions too
  await Offer.create({ productId: product._id, variantId: oid(), sellerId: lateSellerId, sellingPricePaise: 900, mrpPaise: 1200, status: 'LIVE' });
  assert.equal((await call(tokens.stranger, 'GET', '/seller/v1/customer-experience/questions')).body.data.length, 1);
  assert.equal((await call(tokens.seller, 'POST', answerPath, { text: 'Call 9876543210 to ask' })).body.error.code, 'PROHIBITED_CONTENT');
  const sellerAnswer = await call(tokens.seller, 'POST', answerPath, { text: 'Yes, it is fully waterproof.' });
  assert.deepEqual([sellerAnswer.status, sellerAnswer.body.data.status], [201, 'PENDING']);
  assert.equal((await call(tokens.seller, 'POST', answerPath, { text: 'Another answer' })).body.error.code, 'ANSWER_PENDING');
  assert.equal((await call(null, 'GET', `/customer/v1/questions/${qid}`)).body.data.answers.length, 0, 'a pending answer is not public');

  // the admin queue flags it, publishes the answer, and the asker is told
  const queue = (await call(tokens.admin, 'GET', '/admin/v1/questions?unanswered=true')).body;
  assert.deepEqual([queue.data.length, queue.data[0].pendingSellerAnswer.id, queue.meta.facets.status.PUBLISHED], [1, sellerAnswer.body.data.id, 1]);
  assert.equal((await call(tokens.admin, 'POST', `/admin/v1/answers/${sellerAnswer.body.data.id}/moderate`, { status: 'PUBLISHED' })).body.data.status, 'PUBLISHED');
  assert.equal((await call(tokens.admin, 'POST', `/admin/v1/answers/${sellerAnswer.body.data.id}/moderate`, { status: 'PUBLISHED' })).body.error.code, 'NO_CHANGE');
  assert.equal((await call(tokens.admin, 'GET', '/admin/v1/questions?unanswered=true')).body.data.length, 0);
  assert.equal((await Notification.findOne({ recipientId: String(asker._id), title: 'Your question was answered' })).target.entityId, pid);
  const detail = (await call(null, 'GET', `/customer/v1/questions/${qid}`)).body.data;
  assert.deepEqual([detail.answersCount, detail.answers[0].authorType, detail.answers[0].authorDisplayName], [1, 'SELLER', 'Seller']);

  // another customer answers (public at once); nobody votes on their own answer; votes count once and can be taken back
  const peer = await call(tokens.helper, 'POST', `/customer/v1/questions/${qid}/answers`, { body: 'Yes, kept me dry.' });
  assert.deepEqual([peer.status, peer.body.data.moderationStatus, peer.body.data.authorType], [201, 'PUBLISHED', 'CUSTOMER']);
  const helpful = `/customer/v1/answers/${peer.body.data.id}/helpful`;
  assert.equal((await call(tokens.helper, 'PUT', helpful)).body.error.code, 'CANNOT_VOTE_OWN');
  assert.deepEqual((await call(tokens.asker, 'PUT', helpful)).body.data.viewerFoundHelpful, true);
  assert.equal((await call(tokens.asker, 'PUT', helpful)).body.data.helpfulCount, 1, 'one vote per person');
  assert.equal((await call(tokens.asker, 'GET', `/customer/v1/questions/${qid}`)).body.data.answers[0].id, peer.body.data.id, 'most helpful first');
  assert.equal((await call(tokens.asker, 'DELETE', helpful)).body.data.helpfulCount, 0);

  // Arise answers directly; a question can be rejected with a reason the asker sees
  const arise = await call(tokens.admin, 'POST', `/admin/v1/questions/${qid}/answers`, { text: 'Arise confirms: waterproof to IPX4.' });
  assert.deepEqual([arise.status, arise.body.data.authorType], [201, 'ARISE']);
  assert.equal((await call(tokens.admin, 'POST', `/admin/v1/questions/${qid}/moderate`, { status: 'REJECTED' })).status, 422);
  assert.equal((await call(tokens.admin, 'POST', `/admin/v1/questions/${qid}/moderate`, { status: 'REJECTED', reason: 'Off topic' })).body.data.status, 'REJECTED');
  assert.equal((await call(tokens.helper, 'GET', `/customer/v1/questions/${qid}`)).status, 404);
  const mine = (await call(tokens.asker, 'GET', '/customer/v1/questions/mine')).body.data.items[0];
  assert.deepEqual([mine.moderationStatus, mine.rejectionReason], ['REJECTED', 'Off topic']);

  // rate-your-purchase: one reminder per delivered parcel with something left to review, and only once
  const line = { _id: oid(), productId: pid, name: 'Trail Jacket', imageUrl: null, variantLabel: 'M', quantity: 1 };
  const placed = await Order.create({
    number: 'ORD2', customerId: String(asker._id), checkoutSessionId: oid(), paymentId: oid(), paymentMethod: 'upi', address: { city: 'Pune' }, totals: { payablePaise: 1000 },
    subOrders: [{ _id: oid(), sellerId, status: 'DELIVERED', items: [line], deliveredAt: new Date(Date.now() - 5 * 86_400_000), events: [] }],
  });
  await Order.create({
    number: 'ORD3', customerId: String(asker._id), checkoutSessionId: oid(), paymentId: oid(), paymentMethod: 'upi', address: { city: 'Pune' }, totals: { payablePaise: 1000 },
    subOrders: [{ _id: oid(), sellerId, status: 'DELIVERED', items: [{ ...line, _id: oid() }], deliveredAt: new Date(), events: [] }],
  });
  assert.equal(await sendReviewReminders(), 1, 'the parcel delivered an hour ago is too new');
  assert.equal(await sendReviewReminders(), 0, 'already reminded');
  const reminder = await Notification.findOne({ recipientId: String(asker._id), title: 'How was your order?' });
  assert.deepEqual([reminder.body, reminder.target.entityId], ['Rate Trail Jacket and help other shoppers.', String(placed._id)]);
});
