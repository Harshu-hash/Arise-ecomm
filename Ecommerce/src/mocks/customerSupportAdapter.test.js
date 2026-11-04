import {
  customerSupportFixtureAdapter,
  resetCustomerSupportFixture,
} from './customerSupportAdapter';
describe('customerSupportFixtureAdapter', () => {
  beforeEach(resetCustomerSupportFixture);
  it('lists server-managed subjects and paginated tickets', async () => {
    const subjects = await customerSupportFixtureAdapter({
        url: '/support/subjects',
        method: 'get',
      }),
      tickets = await customerSupportFixtureAdapter({
        url: '/support/tickets',
        method: 'get',
        params: { limit: 1 },
      });
    expect(subjects.data.data.items.length).toBeGreaterThan(1);
    expect(tickets.data.data).toMatchObject({ total: 2, nextCursor: '1' });
  });
  it('creates an order-linked ticket with SLA timestamps', async () => {
    const response = await customerSupportFixtureAdapter({
      url: '/support/tickets',
      method: 'post',
      data: {
        subjectCode: 'ORDER_STATUS',
        description: 'Please check the current delivery status.',
        orderId: 'ORD-84920',
        attachmentMediaIds: [],
      },
    });
    expect(response.data.data).toMatchObject({
      status: 'OPEN',
      orderId: 'ORD-84920',
      canReply: true,
      firstResponseDueAt: expect.any(String),
    });
  });
  it('requires an order for order-specific subjects', async () => {
    await expect(
      customerSupportFixtureAdapter({
        url: '/support/tickets',
        method: 'post',
        data: {
          subjectCode: 'ORDER_STATUS',
          description: 'Please check the current delivery status.',
          attachmentMediaIds: [],
        },
      }),
    ).rejects.toMatchObject({ response: { status: 422 } });
  });
  it('persists customer replies and blocks closed tickets', async () => {
    const reply = await customerSupportFixtureAdapter({
      url: '/support/tickets/HLP-101/messages',
      method: 'post',
      data: { body: 'Please share another update.', attachmentMediaIds: [] },
    });
    expect(reply.data.data.messages).toHaveLength(3);
    await expect(
      customerSupportFixtureAdapter({
        url: '/support/tickets/HLP-102/messages',
        method: 'post',
        data: { body: 'Can I reply?', attachmentMediaIds: [] },
      }),
    ).rejects.toMatchObject({ response: { status: 409 } });
  });
  it('serves versioned categories, articles and search', async () => {
    const categories = await customerSupportFixtureAdapter({
      url: '/help/categories',
      method: 'get',
    });
    const article = await customerSupportFixtureAdapter({
      url: '/help/articles/help-order-track',
      method: 'get',
    });
    const search = await customerSupportFixtureAdapter({
      url: '/help/search',
      method: 'get',
      params: { query: 'refund' },
    });
    expect(categories.data.data.items.some(item => item.id === 'plus')).toBe(false);
    expect(article.data.data).toMatchObject({ version: 2, viewerFeedback: null });
    expect(search.data.data.total).toBeGreaterThan(0);
  });
  it('persists article feedback and returns explicit 404s', async () => {
    const updated = await customerSupportFixtureAdapter({
      url: '/help/articles/help-order-track/feedback',
      method: 'put',
      data: { helpful: true },
    });
    expect(updated.data.data.viewerFeedback).toBe('HELPFUL');
    await expect(
      customerSupportFixtureAdapter({ url: '/help/articles/missing', method: 'get' }),
    ).rejects.toMatchObject({ response: { status: 404 } });
  });
});
