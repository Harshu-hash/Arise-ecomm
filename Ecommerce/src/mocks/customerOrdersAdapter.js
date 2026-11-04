import { AxiosError } from 'axios';
import { getAddressFixture } from './customerAddressAdapter';
import { getCreatedOrderFixtures } from './customerCheckoutPaymentAdapter';
import { getProductCardFixture } from './customerSearchProductAdapter';

const LATENCY_MS = 250;
const statusOverrides = new Map();
const statusSequence = [
  'CONFIRMED',
  'PROCESSING',
  'PACKED',
  'SHIPPED',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
];
const statusLabels = [
  'Order placed',
  'Shop preparing',
  'Packed',
  'Shipped',
  'Out for delivery',
  'Delivered',
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
const timelineFor = (status, placedAt) => {
  if (status === 'CANCELLED')
    return [
      {
        id: 'confirmed',
        status: 'CONFIRMED',
        label: 'Order placed',
        occurredAt: placedAt,
        completed: true,
        active: false,
      },
      {
        id: 'cancelled',
        status: 'CANCELLED',
        label: 'Order cancelled',
        occurredAt: new Date(new Date(placedAt).getTime() + 3600000).toISOString(),
        completed: true,
        active: true,
      },
    ];
  const currentIndex = Math.max(0, statusSequence.indexOf(status));
  return statusSequence.map((eventStatus, index) => ({
    id: eventStatus.toLowerCase(),
    status: eventStatus,
    label: statusLabels[index],
    occurredAt:
      index <= currentIndex
        ? new Date(new Date(placedAt).getTime() + index * 86400000).toISOString()
        : null,
    completed: index <= currentIndex,
    active: index === currentIndex,
  }));
};
const itemFrom = (productId, id, canCancel, canReturn) => {
  const product = getProductCardFixture(productId);
  return {
    id,
    productId,
    name: product.name,
    imageUrl: product.imageUrl,
    variantLabel: 'Standard',
    quantity: 1,
    unitPricePaise: product.pricePaise,
    mrpPaise: product.mrpPaise,
    canCancel,
    canReturn,
  };
};
const totalsFor = item => ({
  mrpPaise: item.mrpPaise,
  subtotalPaise: item.unitPricePaise,
  productDiscountPaise: Math.max(item.mrpPaise - item.unitPricePaise, 0),
  couponDiscountPaise: 0,
  deliveryFeePaise: 0,
  platformFeePaise: 500,
  taxPaise: 0,
  walletCreditPaise: 0,
  payablePaise: item.unitPricePaise + 500,
});
const seedOrder = (id, productId, placedAt, status, addressId = 'addr-1') => {
  const canCancel = ['CONFIRMED', 'PROCESSING'].includes(status);
  const canReturn = status === 'DELIVERED';
  const item = itemFrom(productId, `${id}-item-1`, canCancel, canReturn);
  return {
    id,
    placedAt,
    status,
    paymentMethod: status === 'DELIVERED' ? 'COD' : 'UPI',
    paymentStatus: status === 'CANCELLED' ? 'REFUNDED' : 'PAID',
    deliveryCode: ['OUT_FOR_DELIVERY', 'DELIVERED'].includes(status) ? '4829' : null,
    address: getAddressFixture(addressId),
    items: [item],
    totals: totalsFor(item),
    canCancel,
    canReturn,
    timeline: timelineFor(status, placedAt),
  };
};
const seededOrders = () => [
  seedOrder('ORD-84920', 'e1', '2026-08-18T10:42:00.000Z', 'PROCESSING'),
  seedOrder('ORD-77213', 'm1', '2026-07-02T05:35:00.000Z', 'DELIVERED'),
  seedOrder('ORD-65510', 'h2', '2026-06-25T13:10:00.000Z', 'DELIVERED', 'addr-2'),
  seedOrder('ORD-51108', 'f2', '2026-05-10T03:52:00.000Z', 'CANCELLED'),
];
const normalizeCreated = order => {
  const status = statusOverrides.get(order.id) || order.status;
  const canCancel = ['CONFIRMED', 'PROCESSING'].includes(status);
  const canReturn = status === 'DELIVERED';
  return {
    ...order,
    status,
    items: order.items.map(item => ({
      ...item,
      mrpPaise: item.mrpPaise || item.unitPricePaise,
      canCancel,
      canReturn,
    })),
    totals: order.totals || {
      mrpPaise: order.amountPaise,
      subtotalPaise: order.amountPaise,
      productDiscountPaise: 0,
      couponDiscountPaise: 0,
      deliveryFeePaise: 0,
      platformFeePaise: 0,
      taxPaise: 0,
      walletCreditPaise: 0,
      payablePaise: order.amountPaise,
    },
    canCancel,
    canReturn,
    timeline: timelineFor(status, order.placedAt),
  };
};
const allOrders = () =>
  [
    ...getCreatedOrderFixtures().map(normalizeCreated),
    ...seededOrders().map(order => {
      const status = statusOverrides.get(order.id) || order.status;
      return status === order.status
        ? order
        : {
            ...order,
            status,
            canCancel: false,
            canReturn: false,
            timeline: timelineFor(status, order.placedAt),
            paymentStatus: 'REFUNDED',
          };
    }),
  ].sort((a, b) => new Date(b.placedAt) - new Date(a.placedAt));

export const getOrderItemFixture = orderItemId => {
  for (const order of allOrders()) {
    const item = order.items.find(candidate => candidate.id === orderItemId);
    if (item) return { order, item };
  }
  return null;
};
export const getOrderFixture = orderId => allOrders().find(order => order.id === orderId) || null;

export const resetCustomerOrdersFixture = () => statusOverrides.clear();

export const customerOrdersFixtureAdapter = async config => {
  await wait();
  if (config.url === '/orders' && config.method === 'get') {
    const group = config.params?.statusGroup;
    let items = allOrders();
    if (group === 'Processing')
      items = items.filter(order => !['DELIVERED', 'CANCELLED'].includes(order.status));
    if (group === 'Delivered') items = items.filter(order => order.status === 'DELIVERED');
    if (group === 'Cancelled')
      items = items.filter(order => order.status === 'CANCELLED');
    const offset = Number(config.params?.cursor || 0);
    const limit = Math.min(Number(config.params?.limit || 10), 20);
    const page = items.slice(offset, offset + limit);
    return response(config, {
      data: {
        items: page,
        total: items.length,
        nextCursor: offset + limit < items.length ? String(offset + limit) : null,
      },
    });
  }
  const timelineMatch = config.url?.match(/^\/orders\/([^/]+)\/timeline$/);
  if (timelineMatch && config.method === 'get') {
    const order = allOrders().find(item => item.id === decodeURIComponent(timelineMatch[1]));
    if (!order) return reject(config, 404, 'ORDER_NOT_FOUND', 'This order was not found.');
    return response(config, { data: { items: order.timeline } });
  }
  const cancelMatch = config.url?.match(/^\/orders\/([^/]+)\/cancel$/);
  if (cancelMatch && config.method === 'post') {
    const orderId = decodeURIComponent(cancelMatch[1]);
    const order = allOrders().find(item => item.id === orderId);
    if (!order) return reject(config, 404, 'ORDER_NOT_FOUND', 'This order was not found.');
    if (!order.canCancel)
      return reject(config, 409, 'ORDER_NOT_CANCELLABLE', 'This order can no longer be cancelled.');
    if (!config.data?.reason)
      return reject(config, 422, 'CANCELLATION_REASON_REQUIRED', 'Choose a cancellation reason.');
    statusOverrides.set(orderId, 'CANCELLED');
    return response(config, { data: allOrders().find(item => item.id === orderId) });
  }
  const detailMatch = config.url?.match(/^\/orders\/([^/]+)$/);
  if (detailMatch && config.method === 'get') {
    const order = allOrders().find(item => item.id === decodeURIComponent(detailMatch[1]));
    if (!order) return reject(config, 404, 'ORDER_NOT_FOUND', 'This order was not found.');
    return response(config, { data: order });
  }
  return reject(
    config,
    501,
    'FIXTURE_NOT_IMPLEMENTED',
    `No fixture exists for ${config.method?.toUpperCase()} ${config.url}.`,
  );
};

export const createOrdersFixtureEnvelope = params => {
  const items = allOrders();
  return { data: { items, total: items.length, nextCursor: null }, params };
};
