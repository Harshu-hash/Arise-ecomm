import { mapReturnEligibility, mapReturnList, mapReturnRequest } from './returns.mapper';

describe('return contract mappers', () => {
  it('validates server-owned eligibility and reason metadata', () => {
    const result = mapReturnEligibility({
      data: {
        orderId: 'ORD-1',
        items: [
          {
            orderItemId: 'item-1',
            productId: 'p1',
            name: 'Product',
            imageUrl: 'https://example.com/p.jpg',
            quantity: 1,
            eligible: true,
            ineligibleReason: null,
            returnWindowEndsAt: '2026-11-10T00:00:00.000Z',
            allowedResolutions: ['REFUND'],
          },
        ],
        reasons: [{ code: 'DAMAGED', label: 'Damaged', requiresEvidence: true }],
        pickupRequired: true,
        refundDestinations: ['ORIGINAL_PAYMENT'],
      },
    });
    expect(result.items[0]).toMatchObject({ eligible: true, allowedResolutions: ['REFUND'] });
    expect(result.reasons[0].requiresEvidence).toBe(true);
  });

  it('maps refund money without changing workflow status', () => {
    const request = mapReturnRequest({
      data: {
        id: 'return-1',
        orderId: 'ORD-1',
        orderItemId: 'item-1',
        resolution: 'REFUND',
        reasonCode: 'SIZE_FIT',
        status: 'PICKUP_SCHEDULED',
        pickupAddressId: 'addr-1',
        pickupWindowLabel: '2-3 days',
        evidenceMediaIds: [],
        createdAt: '2026-11-03T00:00:00.000Z',
        refund: { status: 'NOT_REQUIRED', amountPaise: 129900, destination: 'ORIGINAL_PAYMENT' },
      },
    });
    expect(request).toMatchObject({ status: 'PICKUP_SCHEDULED', refund: { amount: 1299 } });
  });

  it('keeps what the status screen shows: timeline, courier, refund state and whether it can be cancelled', () => {
    const { items, nextCursor } = mapReturnList({
      data: {
        items: [
          {
            id: 'return-2',
            orderId: 'ORD-1',
            orderItemId: 'item-1',
            resolution: 'REFUND',
            reasonCode: 'DAMAGED',
            status: 'PICKUP_SCHEDULED',
            pickupAddressId: 'addr-1',
            pickupWindowLabel: 'BlueDart will collect it (tracking AWB1)',
            evidenceMediaIds: [],
            createdAt: '2026-11-03T00:00:00.000Z',
            refund: { status: 'NOT_REQUIRED', amountPaise: 50000, destination: 'ORIGINAL_PAYMENT' },
            productName: 'Running Shoes',
            courier: { name: 'BlueDart', awb: 'AWB1' },
            canCancel: true,
            timeline: [{ status: 'REQUESTED', label: 'Return requested', at: '2026-11-03T00:00:00.000Z' }],
            journey: [
              { status: 'REQUESTED', label: 'Return requested', state: 'DONE', at: '2026-11-03T00:00:00.000Z' },
              { status: 'APPROVED', label: 'Seller approval', state: 'PENDING', at: null },
            ],
          },
        ],
        total: 1,
        nextCursor: null,
      },
    });
    expect(nextCursor).toBeNull();
    expect(items[0]).toMatchObject({ productName: 'Running Shoes', canCancel: true, courier: { awb: 'AWB1' }, refund: { amount: 500 } });
    expect(items[0].timeline[0].label).toBe('Return requested');
    expect(items[0].journey.map(step => step.state)).toEqual(['DONE', 'PENDING']);
  });
});
