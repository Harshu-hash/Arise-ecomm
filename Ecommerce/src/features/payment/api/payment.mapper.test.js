import { mapPayment, mapPlacedOrder } from './payment.mapper';

describe('payment and placed-order mappers', () => {
  it('maps payment paise without changing backend status', () => {
    expect(
      mapPayment({
        data: {
          id: 'payment-1',
          checkoutSessionId: 'checkout-1',
          method: 'upi',
          status: 'SUCCEEDED',
          amountPaise: 30700,
          currency: 'INR',
          providerAction: { type: 'NONE', url: null },
        },
      }),
    ).toMatchObject({ status: 'SUCCEEDED', amount: 307 });
  });

  it('maps a backend-created order for the success screen', () => {
    const order = mapPlacedOrder({
      data: {
        id: 'ORD-10001',
        placedAt: '2026-11-03T10:00:00.000Z',
        status: 'CONFIRMED',
        paymentMethod: 'UPI',
        paymentStatus: 'PAID',
        amountPaise: 30700,
        deliveryCode: '4821',
        address: {
          id: 'addr-1',
          label: 'Home',
          isDefault: true,
          name: 'Test Customer',
          phone: '+91 99999 99999',
          line: 'Test Street',
          city: 'Ahmedabad',
          state: 'Gujarat',
          pincode: '380015',
        },
        items: [
          {
            id: 'line-1',
            productId: 'h2',
            name: 'Notebook',
            imageUrl: 'https://example.com/item.jpg',
            variantLabel: 'Standard',
            quantity: 1,
            unitPricePaise: 29800,
          },
        ],
      },
    });
    expect(order).toMatchObject({ id: 'ORD-10001', status: 'Confirmed', price: 307 });
  });
});
