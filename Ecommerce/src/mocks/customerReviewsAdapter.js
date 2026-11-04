import { AxiosError } from 'axios';
import { getMediaFixture } from './customerMediaAdapter';
import { getOrderItemFixture } from './customerOrdersAdapter';

const LATENCY_MS = 250;
let counter = 3;
const now = '2026-08-22T10:30:00.000Z';
const reviews = new Map([
  [
    'review-1',
    {
      id: 'review-1',
      productId: 'm1',
      productName: 'Samsung Galaxy M14 5G (ICY Silver, 128 GB)',
      productImageUrl:
        'https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&w=500&q=80',
      orderItemId: 'ORD-77213-item-1',
      rating: 4,
      title: 'Good value',
      body: 'Good performance for the price and reliable battery life.',
      media: [],
      authorDisplayName: 'Verified customer',
      verifiedPurchase: true,
      helpfulCount: 11,
      moderationStatus: 'PUBLISHED',
      rejectionReason: null,
      allowedActions: ['EDIT', 'DELETE'],
      createdAt: now,
      updatedAt: now,
    },
  ],
  [
    'review-2',
    {
      id: 'review-2',
      productId: 'e1',
      productName: 'boAt Airdopes 141 Bluetooth Truly Wireless Earbuds',
      productImageUrl:
        'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=500&q=80',
      orderItemId: 'historical-e1-item',
      rating: 5,
      title: 'Excellent sound',
      body: 'Clear sound, comfortable fit and very good battery backup.',
      media: [],
      authorDisplayName: 'Marketplace customer',
      verifiedPurchase: true,
      helpfulCount: 24,
      moderationStatus: 'PUBLISHED',
      rejectionReason: null,
      allowedActions: [],
      createdAt: now,
      updatedAt: now,
    },
  ],
]);
const wait = () => new Promise(resolve => setTimeout(resolve, LATENCY_MS));
const response = (config, data, status = 200) => ({
  data,
  status,
  statusText: status < 400 ? 'OK' : 'Error',
  headers: { 'content-type': 'application/json' },
  config,
  request: null,
});
const reject = (config, status, code, message) => {
  throw new AxiosError(
    message,
    code,
    config,
    null,
    response(config, { error: { code, message } }, status),
  );
};
const paged = (items, config, summary = null) => {
  const offset = Number(config.params?.cursor || 0);
  const limit = Math.min(Number(config.params?.limit || 10), 20);
  return {
    items: items.slice(offset, offset + limit),
    total: items.length,
    nextCursor: offset + limit < items.length ? String(offset + limit) : null,
    summary,
  };
};
const owned = review => review.allowedActions.length > 0;
export const resetCustomerReviewsFixture = () => {
  counter = 3;
  for (const [id, review] of [...reviews])
    if (Number(id.replace('review-', '')) >= 3) reviews.delete(id);
};

export const customerReviewsFixtureAdapter = async config => {
  await wait();
  if (config.url === '/reviews/mine' && config.method === 'get')
    return response(config, { data: paged([...reviews.values()].filter(owned), config) });
  const productMatch = config.url?.match(/^\/products\/([^/]+)\/reviews$/);
  if (productMatch && config.method === 'get') {
    const items = [...reviews.values()].filter(
      item =>
        item.productId === decodeURIComponent(productMatch[1]) &&
        item.moderationStatus === 'PUBLISHED',
    );
    const average = items.length
      ? items.reduce((sum, item) => sum + item.rating, 0) / items.length
      : 0;
    return response(config, { data: paged(items, config, { average, count: items.length }) });
  }
  const eligibilityMatch = config.url?.match(/^\/order-items\/([^/]+)\/review-eligibility$/);
  if (eligibilityMatch && config.method === 'get') {
    const orderItemId = decodeURIComponent(eligibilityMatch[1]);
    const match = getOrderItemFixture(orderItemId);
    if (!match)
      return reject(config, 404, 'ORDER_ITEM_NOT_FOUND', 'This order item was not found.');
    const existing = [...reviews.values()].find(item => item.orderItemId === orderItemId);
    const delivered = match.order.status === 'DELIVERED';
    return response(config, {
      data: {
        orderItemId,
        productId: match.item.productId,
        productName: match.item.name,
        productImageUrl: match.item.imageUrl,
        eligible: delivered && !existing,
        reason: !delivered
          ? 'Reviews are available after delivery.'
          : existing
            ? 'You already reviewed this item.'
            : null,
        existingReviewId: existing?.id || null,
      },
    });
  }
  if (config.url === '/reviews' && config.method === 'post') {
    const { orderItemId, rating, title = '', body, mediaIds = [] } = config.data || {};
    const match = getOrderItemFixture(orderItemId);
    if (!match || match.order.status !== 'DELIVERED')
      return reject(config, 409, 'REVIEW_NOT_ELIGIBLE', 'Only delivered items can be reviewed.');
    if ([...reviews.values()].some(item => item.orderItemId === orderItemId))
      return reject(config, 409, 'REVIEW_ALREADY_EXISTS', 'You already reviewed this item.');
    if (!Number.isInteger(rating) || rating < 1 || rating > 5 || body?.trim().length < 10)
      return reject(
        config,
        422,
        'REVIEW_INVALID',
        'Choose a rating and write at least 10 characters.',
      );
    const media = mediaIds.map(getMediaFixture);
    if (media.some(item => !item))
      return reject(config, 422, 'MEDIA_INVALID', 'One or more attachments are invalid.');
    const review = {
      id: `review-${counter++}`,
      productId: match.item.productId,
      productName: match.item.name,
      productImageUrl: match.item.imageUrl,
      orderItemId,
      rating,
      title: title.trim(),
      body: body.trim(),
      media: media.map(({ id, url, thumbnailUrl }) => ({ id, url, thumbnailUrl })),
      authorDisplayName: 'Verified customer',
      verifiedPurchase: true,
      helpfulCount: 0,
      moderationStatus: 'PENDING',
      rejectionReason: null,
      allowedActions: ['EDIT', 'DELETE'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    reviews.set(review.id, review);
    return response(config, { data: review }, 201);
  }
  const detailMatch = config.url?.match(/^\/reviews\/([^/]+)$/);
  if (detailMatch) {
    const id = decodeURIComponent(detailMatch[1]);
    const review = reviews.get(id);
    if (!review || !owned(review))
      return reject(config, 404, 'REVIEW_NOT_FOUND', 'This review was not found.');
    if (config.method === 'delete') {
      reviews.delete(id);
      return response(config, { data: { deleted: true } });
    }
    if (config.method === 'patch') {
      const body = config.data?.body?.trim();
      const rating = config.data?.rating;
      if (!Number.isInteger(rating) || rating < 1 || rating > 5 || body?.length < 10)
        return reject(
          config,
          422,
          'REVIEW_INVALID',
          'Choose a rating and write at least 10 characters.',
        );
      const updated = {
        ...review,
        rating,
        title: (config.data.title || '').trim(),
        body,
        moderationStatus: 'PENDING',
        rejectionReason: null,
        updatedAt: new Date().toISOString(),
      };
      reviews.set(id, updated);
      return response(config, { data: updated });
    }
  }
  return reject(
    config,
    501,
    'FIXTURE_NOT_IMPLEMENTED',
    `No fixture exists for ${config.method?.toUpperCase()} ${config.url}.`,
  );
};
