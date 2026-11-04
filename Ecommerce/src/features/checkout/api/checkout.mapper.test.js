import { mapCheckoutSession } from './checkout.mapper';

const payload = () => ({
  data: {
    id: 'checkout-1',
    status: 'READY',
    source: 'CART',
    cartVersion: 1,
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
    lines: [
      {
        lineId: 'line-1',
        productId: 'e1',
        name: 'Earbuds',
        imageUrl: 'https://example.com/item.jpg',
        variantLabel: 'Black',
        quantity: 2,
        unitPricePaise: 129900,
        mrpPaise: 249000,
        lineTotalPaise: 259800,
        sellerId: 'seller-1',
        sellerName: 'Seller',
        deliveryPromise: '3 days',
      },
    ],
    totals: {
      mrpPaise: 498000,
      subtotalPaise: 259800,
      productDiscountPaise: 238200,
      couponDiscountPaise: 0,
      deliveryFeePaise: 0,
      platformFeePaise: 500,
      taxPaise: 0,
      walletCreditPaise: 0,
      payablePaise: 260300,
    },
    couponCode: null,
    allowedPaymentMethods: ['upi', 'cod'],
    selectedPaymentMethod: null,
    codEligible: true,
    expiresAt: '2026-11-03T12:00:00.000Z',
    warnings: [],
    blockers: [],
  },
});

describe('checkout contract mapper', () => {
  it('maps the immutable server quote to display money', () => {
    const session = mapCheckoutSession(payload());
    expect(session.items[0]).toMatchObject({ qty: 2, price: 1299, lineTotal: 2598 });
    expect(session.totals).toMatchObject({ payable: 2603, platformFee: 5 });
  });

  it('rejects fractional paise totals', () => {
    const malformed = payload();
    malformed.data.totals.payablePaise = 2.5;
    expect(() => mapCheckoutSession(malformed)).toThrow();
  });
});
