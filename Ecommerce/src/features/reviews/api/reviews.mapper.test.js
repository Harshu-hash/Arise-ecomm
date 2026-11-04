import { mapReviewEligibility, mapReviews } from './reviews.mapper';

const review = {
  id: 'review-1',
  productId: 'm1',
  productName: 'Phone',
  productImageUrl: 'https://example.com/phone.jpg',
  orderItemId: 'item-1',
  rating: 4,
  title: 'Good',
  body: 'A reliable product.',
  media: [],
  authorDisplayName: 'Verified customer',
  verifiedPurchase: true,
  helpfulCount: 2,
  moderationStatus: 'PUBLISHED',
  rejectionReason: null,
  allowedActions: ['EDIT', 'DELETE'],
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
};

describe('review mappers', () => {
  it('maps validated reviews and server permissions', () => {
    const result = mapReviews({
      data: { items: [review], total: 1, nextCursor: null, summary: null },
    });
    expect(result.items[0]).toMatchObject({
      product: 'Phone',
      text: 'A reliable product.',
      canEdit: true,
      canDelete: true,
    });
  });
  it('validates review eligibility', () => {
    expect(
      mapReviewEligibility({
        data: {
          orderItemId: 'item-1',
          productId: 'm1',
          productName: 'Phone',
          productImageUrl: 'https://example.com/phone.jpg',
          eligible: true,
          reason: null,
          existingReviewId: null,
        },
      }).eligible,
    ).toBe(true);
  });
  it('rejects invalid ratings', () => {
    expect(() =>
      mapReviews({
        data: { items: [{ ...review, rating: 6 }], total: 1, nextCursor: null, summary: null },
      }),
    ).toThrow();
  });
});
