import { mapAddress } from '@features/address/api/address.mapper';
import {
  orderResponseSchema,
  paymentMethodSetupResponseSchema,
  paymentMethodsResponseSchema,
  paymentResponseSchema,
} from './payment.schemas';

export const mapPayment = payload => {
  const payment = paymentResponseSchema.parse(payload).data;
  return { ...payment, amount: payment.amountPaise / 100 };
};
export const mapPlacedOrder = payload => {
  const order = orderResponseSchema.parse(payload).data;
  const placedAt = new Date(order.placedAt);
  const items = order.items.map(item => ({
    id: item.id,
    productId: item.productId,
    name: item.name,
    image: item.imageUrl,
    variant: item.variantLabel,
    qty: item.quantity,
    price: item.unitPricePaise / 100,
  }));
  const grandTotal = order.amountPaise / 100;
  return {
    ...order,
    placedOn: placedAt.toLocaleString('en-IN'),
    date: placedAt.toLocaleDateString('en-IN'),
    status: order.status === 'CONFIRMED' ? 'Confirmed' : 'Processing',
    currentStep: 1,
    canCancel: true,
    canReturn: false,
    address: mapAddress(order.address),
    items,
    priceDetails: { grandTotal },
    name: items[0]?.name,
    image: items[0]?.image,
    price: grandTotal,
  };
};

export const mapPaymentMethods = payload => paymentMethodsResponseSchema.parse(payload).data;
export const mapPaymentMethodSetup = payload =>
  paymentMethodSetupResponseSchema.parse(payload).data;
