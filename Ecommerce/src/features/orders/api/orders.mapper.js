import { mapAddress } from '@features/address/api/address.mapper';
import {
  orderResponseSchema,
  ordersResponseSchema,
  timelineResponseSchema,
} from './orders.schemas';

const labels = {
  PENDING_PAYMENT: 'Payment Pending',
  CONFIRMED: 'Confirmed',
  PROCESSING: 'Processing',
  PACKED: 'Packed',
  READY_TO_SHIP: 'Ready to Ship',
  SHIPPED: 'Shipped',
  IN_TRANSIT: 'In Transit',
  OUT_FOR_DELIVERY: 'Out for Delivery',
  DELIVERED: 'Delivered',
  PAYMENT_FAILED: 'Payment Failed',
  DELIVERY_FAILED: 'Delivery Attempt Failed',
  CANCELLED: 'Cancelled',
};
const toRupees = paise => paise / 100;
export const mapOrder = order => {
  const items = order.items.map(item => ({
    id: item.id,
    productId: item.productId,
    name: item.name,
    image: item.imageUrl,
    variant: item.variantLabel,
    qty: item.quantity,
    price: toRupees(item.unitPricePaise),
    mrp: toRupees(item.mrpPaise),
    canCancel: item.canCancel,
    canReturn: item.canReturn,
  }));
  const totals = Object.fromEntries(
    Object.entries(order.totals).map(([key, value]) => [key.replace('Paise', ''), toRupees(value)]),
  );
  return {
    ...order,
    statusCode: order.status,
    status: labels[order.status],
    placedOn: new Date(order.placedAt).toLocaleString('en-IN'),
    date: new Date(order.placedAt).toLocaleDateString('en-IN'),
    address: mapAddress(order.address),
    items,
    priceDetails: {
      itemTotal: totals.subtotal,
      deliveryFee: totals.deliveryFee,
      platformFee: totals.platformFee,
      discount: totals.productDiscount + totals.couponDiscount,
      grandTotal: totals.payable,
    },
    currentStep: Math.max(1, order.timeline.filter(event => event.completed).length),
    name: items[0]?.name,
    image: items[0]?.image,
    price: totals.payable,
  };
};
export const mapOrders = payload => {
  const data = ordersResponseSchema.parse(payload).data;
  return { ...data, items: data.items.map(mapOrder) };
};
export const mapOrderResponse = payload => mapOrder(orderResponseSchema.parse(payload).data);
export const mapTimeline = payload => timelineResponseSchema.parse(payload).data.items;
