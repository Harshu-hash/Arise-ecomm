import { AxiosError } from 'axios';
import { getAddressFixture } from './customerAddressAdapter';
import { getOrderFixture } from './customerOrdersAdapter';
import { getMediaFixture } from './customerMediaAdapter';

const LATENCY_MS = 250;
let returnCounter = 1;
const returnRequests = new Map();
const reasons = [
  { code: 'DAMAGED', label: 'Item is damaged or defective', requiresEvidence: true },
  { code: 'NOT_AS_DESCRIBED', label: 'Item is not as described', requiresEvidence: false },
  { code: 'WRONG_ITEM', label: 'Received the wrong item', requiresEvidence: true },
  { code: 'SIZE_FIT', label: 'Size or fit issue', requiresEvidence: false },
  { code: 'CHANGED_MIND', label: 'Changed my mind', requiresEvidence: false },
];
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
const existingForItem = orderItemId =>
  [...returnRequests.values()].find(
    request => request.orderItemId === orderItemId && request.status !== 'CANCELLED',
  );
const eligibilityFor = (config, orderId) => {
  const order = getOrderFixture(orderId);
  if (!order) return reject(config, 404, 'ORDER_NOT_FOUND', 'This order was not found.');
  return {
    orderId,
    items: order.items.map(item => {
      const duplicate = existingForItem(item.id);
      const eligible = order.status === 'DELIVERED' && item.canReturn && !duplicate;
      return {
        orderItemId: item.id,
        productId: item.productId,
        name: item.name,
        imageUrl: item.imageUrl,
        quantity: item.quantity,
        eligible,
        ineligibleReason: eligible
          ? null
          : duplicate
            ? 'A return request already exists for this item.'
            : 'The return window is closed.',
        returnWindowEndsAt:
          order.status === 'DELIVERED'
            ? new Date(new Date(order.placedAt).getTime() + 10 * 86400000).toISOString()
            : null,
        allowedResolutions: eligible ? ['REFUND', 'REPLACEMENT'] : [],
      };
    }),
    reasons,
    pickupRequired: true,
    refundDestinations: ['ORIGINAL_PAYMENT', 'STORE_CREDIT'],
  };
};

export const resetCustomerReturnsFixture = () => {
  returnCounter = 1;
  returnRequests.clear();
};

export const customerReturnsFixtureAdapter = async config => {
  await wait();
  const eligibilityMatch = config.url?.match(/^\/orders\/([^/]+)\/returnable-items$/);
  if (eligibilityMatch && config.method === 'get') {
    return response(config, {
      data: eligibilityFor(config, decodeURIComponent(eligibilityMatch[1])),
    });
  }
  if (config.url === '/returns' && config.method === 'post') {
    const input = config.data || {};
    const eligibility = eligibilityFor(config, input.orderId);
    const item = eligibility.items.find(entry => entry.orderItemId === input.orderItemId);
    if (!item?.eligible)
      return reject(
        config,
        409,
        'ITEM_NOT_RETURNABLE',
        item?.ineligibleReason || 'This item cannot be returned.',
      );
    if (!item.allowedResolutions.includes(input.resolution))
      return reject(config, 409, 'RESOLUTION_NOT_AVAILABLE', 'Choose an available resolution.');
    const reason = reasons.find(entry => entry.code === input.reasonCode);
    if (!reason) return reject(config, 422, 'RETURN_REASON_REQUIRED', 'Choose a return reason.');
    if (reason.requiresEvidence && !(input.evidenceMediaIds || []).length) {
      return reject(config, 422, 'EVIDENCE_REQUIRED', 'Add a photo for this return reason.');
    }
    if ((input.evidenceMediaIds || []).some(mediaId => !getMediaFixture(mediaId))) {
      return reject(config, 422, 'EVIDENCE_INVALID', 'One or more evidence uploads are invalid.');
    }
    if (!getAddressFixture(input.pickupAddressId))
      return reject(config, 404, 'PICKUP_ADDRESS_NOT_FOUND', 'Choose a valid pickup address.');
    const order = getOrderFixture(input.orderId);
    const orderItem = order.items.find(entry => entry.id === input.orderItemId);
    const request = {
      id: `return-${returnCounter++}`,
      orderId: input.orderId,
      orderItemId: input.orderItemId,
      resolution: input.resolution,
      reasonCode: input.reasonCode,
      status: 'PICKUP_SCHEDULED',
      pickupAddressId: input.pickupAddressId,
      pickupWindowLabel: 'Pickup within 2-3 business days',
      evidenceMediaIds: input.evidenceMediaIds || [],
      createdAt: new Date().toISOString(),
      refund: {
        status: 'NOT_REQUIRED',
        amountPaise: orderItem.unitPricePaise,
        destination: input.refundDestination || 'ORIGINAL_PAYMENT',
      },
    };
    returnRequests.set(request.id, request);
    return response(config, { data: request }, 201);
  }
  const cancelMatch = config.url?.match(/^\/returns\/([^/]+)\/cancel$/);
  if (cancelMatch && config.method === 'post') {
    const request = returnRequests.get(decodeURIComponent(cancelMatch[1]));
    if (!request)
      return reject(config, 404, 'RETURN_NOT_FOUND', 'This return request was not found.');
    if (!['REQUESTED', 'PICKUP_SCHEDULED'].includes(request.status))
      return reject(
        config,
        409,
        'RETURN_NOT_CANCELLABLE',
        'This return can no longer be cancelled.',
      );
    request.status = 'CANCELLED';
    return response(config, { data: request });
  }
  const detailMatch = config.url?.match(/^\/returns\/([^/]+)$/);
  if (detailMatch && config.method === 'get') {
    const request = returnRequests.get(decodeURIComponent(detailMatch[1]));
    if (!request)
      return reject(config, 404, 'RETURN_NOT_FOUND', 'This return request was not found.');
    return response(config, { data: request });
  }
  return reject(
    config,
    501,
    'FIXTURE_NOT_IMPLEMENTED',
    `No fixture exists for ${config.method?.toUpperCase()} ${config.url}.`,
  );
};

export const getReturnFixture = returnId => returnRequests.get(returnId) ?? null;
