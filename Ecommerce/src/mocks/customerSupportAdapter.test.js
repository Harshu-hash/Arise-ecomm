import {
  customerSupportFixtureAdapter,
  resetCustomerSupportFixture,
} from './customerSupportAdapter';
describe('customerSupportFixtureAdapter', () => {
  beforeEach(resetCustomerSupportFixture);
  it('lists call, email and chat channels', async () => {
    const response = await customerSupportFixtureAdapter({ url: '/support/channels', method: 'get' });
    expect(response.data.data.channels.map(channel => channel.type)).toEqual(['CHAT', 'PHONE', 'EMAIL']);
  });
  it('has no chat until the first message, which opens one linked to the order', async () => {
    const empty = await customerSupportFixtureAdapter({ url: '/support/chat', method: 'get' });
    expect(empty.data.data).toBeNull();
    const sent = await customerSupportFixtureAdapter({
      url: '/support/chat/messages',
      method: 'post',
      data: { body: 'Where is my order?', orderId: 'ORD-84920' },
    });
    expect(sent.data.data).toMatchObject({ status: 'OPEN', orderId: 'ORD-84920', unreadCount: 0 });
    const again = await customerSupportFixtureAdapter({
      url: '/support/chat/messages',
      method: 'post',
      data: { body: 'Hello?' },
    });
    expect(again.data.data.messages).toHaveLength(2);
  });
  it('sends a photo-only message, lists the chat in history and opens it', async () => {
    const sent = await customerSupportFixtureAdapter({
      url: '/support/chat/messages',
      method: 'post',
      data: { attachments: ['private/chat/u1/p.jpg'] },
    });
    expect(sent.data.data.messages[0].attachments).toHaveLength(1);
    const history = await customerSupportFixtureAdapter({ url: '/support/chats', method: 'get' });
    expect(history.data.data.items[0]).toMatchObject({ id: 'chat-1', lastMessagePreview: 'Photo' });
    const opened = await customerSupportFixtureAdapter({ url: '/support/chats/chat-1', method: 'get' });
    expect(opened.data.data.messages).toHaveLength(1);
  });
  it('rejects a blank chat message', async () => {
    await expect(
      customerSupportFixtureAdapter({ url: '/support/chat/messages', method: 'post', data: { body: '  ' } }),
    ).rejects.toMatchObject({ response: { status: 422 } });
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
