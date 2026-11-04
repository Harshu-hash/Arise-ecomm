import {
  customerReviewsFixtureAdapter,
  resetCustomerReviewsFixture,
} from './customerReviewsAdapter';

describe('customerReviewsFixtureAdapter', () => {
  beforeEach(resetCustomerReviewsFixture);
  it('derives eligibility from delivered order items', async () => {
    const eligible = await customerReviewsFixtureAdapter({
      url: '/order-items/ORD-65510-item-1/review-eligibility',
      method: 'get',
    });
    const duplicate = await customerReviewsFixtureAdapter({
      url: '/order-items/ORD-77213-item-1/review-eligibility',
      method: 'get',
    });
    expect(eligible.data.data.eligible).toBe(true);
    expect(duplicate.data.data).toMatchObject({ eligible: false, existingReviewId: 'review-1' });
  });
  it('creates one verified review per delivered order item', async () => {
    const created = await customerReviewsFixtureAdapter({
      url: '/reviews',
      method: 'post',
      data: {
        orderItemId: 'ORD-65510-item-1',
        rating: 5,
        title: 'Excellent',
        body: 'Exactly what I expected.',
        mediaIds: [],
      },
    });
    expect(created.data.data).toMatchObject({
      verifiedPurchase: true,
      moderationStatus: 'PENDING',
    });
    await expect(
      customerReviewsFixtureAdapter({
        url: '/reviews',
        method: 'post',
        data: {
          orderItemId: 'ORD-65510-item-1',
          rating: 5,
          body: 'A second review is invalid.',
          mediaIds: [],
        },
      }),
    ).rejects.toMatchObject({ response: { status: 409 } });
  });
  it('updates and deletes an owned review', async () => {
    const updated = await customerReviewsFixtureAdapter({
      url: '/reviews/review-1',
      method: 'patch',
      data: { rating: 3, title: 'Updated', body: 'Updated review content.' },
    });
    expect(updated.data.data).toMatchObject({ rating: 3, moderationStatus: 'PENDING' });
    const deleted = await customerReviewsFixtureAdapter({
      url: '/reviews/review-1',
      method: 'delete',
    });
    expect(deleted.data.data.deleted).toBe(true);
  });
});
