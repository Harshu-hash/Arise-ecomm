import { AxiosError } from 'axios';
import { getOrderFixture } from './customerOrdersAdapter';

const LATENCY_MS = 200;
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
const statusLabels = {
  CONFIRMED: 'Order confirmed',
  PROCESSING: 'Preparing your order',
  PACKED: 'Packed',
  SHIPPED: 'Shipped',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};
const trackingEnvelope = (config, shipmentId) => {
  const order = getOrderFixture(shipmentId);
  if (!order)
    return reject(config, 404, 'SHIPMENT_NOT_FOUND', 'Tracking is unavailable for this order.');
  const status = order.status;
  const outForDelivery = status === 'OUT_FOR_DELIVERY';
  const delivered = status === 'DELIVERED';
  const etaDate =
    delivered || status === 'CANCELLED' ? null : new Date(Date.now() + 3 * 86400000).toISOString();
  return {
    data: {
      shipmentId,
      orderId: order.id,
      status,
      statusLabel: statusLabels[status],
      updatedAt: new Date().toISOString(),
      eta: {
        label: delivered
          ? 'Delivered successfully'
          : status === 'CANCELLED'
            ? 'Shipment cancelled'
            : 'Expected within 3 business days',
        estimatedAt: etaDate,
        delayed: false,
      },
      courier: {
        name: 'Arise Logistics',
        trackingNumber: `AR-${order.id.replace('ORD-', '')}`,
        supportPhone: null,
      },
      deliveryAgent: outForDelivery
        ? {
            displayName: 'Delivery partner assigned',
            vehicleLabel: null,
            maskedPhone: '******4829',
            contactAllowed: false,
            location: null,
          }
        : null,
      deliveryCode: order.deliveryCode
        ? {
            masked: `**${order.deliveryCode.slice(-2)}`,
            revealAllowed: outForDelivery,
            value: outForDelivery ? order.deliveryCode : null,
          }
        : null,
      attempts: [],
      events: order.timeline.map(event => ({
        id: event.id,
        label: event.label,
        description: event.completed
          ? 'Completed'
          : event.active
            ? 'Current shipment stage'
            : 'Pending',
        occurredAt: event.occurredAt,
        completed: event.completed,
        active: event.active,
      })),
      pollingIntervalSeconds: 30,
    },
  };
};

export const customerTrackingFixtureAdapter = async config => {
  await wait();
  const match = config.url?.match(/^\/shipments\/([^/]+)\/tracking$/);
  if (match && config.method === 'get')
    return response(config, trackingEnvelope(config, decodeURIComponent(match[1])));
  return reject(
    config,
    501,
    'FIXTURE_NOT_IMPLEMENTED',
    `No fixture exists for ${config.method?.toUpperCase()} ${config.url}.`,
  );
};

export const createTrackingFixtureEnvelope = shipmentId =>
  trackingEnvelope({ url: `/shipments/${shipmentId}/tracking`, method: 'get' }, shipmentId);
