import {
  mapHelpArticle,
  mapHelpCategories,
  mapHelpSearch,
  mapChat,
  mapChatList,
} from './support.mapper';
const chat = {
  id: 'c1',
  status: 'OPEN',
  orderId: null,
  createdAt: '2026-11-01T08:00:00.000Z',
  lastMessageAt: '2026-11-01T08:00:00.000Z',
  lastMessagePreview: 'Hi',
  unreadCount: 2,
  messages: [
    { id: 'm1', authorType: 'CUSTOMER', authorDisplayName: 'You', body: 'Hi', attachments: [{ id: 'k', url: 'https://x/k.jpg' }], createdAt: '2026-11-01T08:00:00.000Z' },
  ],
};
describe('support mappers', () => {
  it('maps a chat, and no chat yet', () => {
    expect(mapChat({ data: chat }).messages[0]).toMatchObject({ body: 'Hi', attachments: [{ id: 'k' }], date: expect.any(String) });
    expect(mapChat({ data: null })).toBeNull();
  });
  it('maps the chat history list', () => {
    const { messages, ...summary } = chat;
    expect(mapChatList({ data: { items: [summary], nextCursor: null } }).items[0]).toMatchObject({ id: 'c1', unreadCount: 2, date: expect.any(String) });
  });
  it('rejects unknown author types', () => {
    expect(() => mapChat({ data: { ...chat, messages: [{ ...chat.messages[0], authorType: 'BOT' }] } })).toThrow();
  });
  it('maps versioned help content and search results', () => {
    const summary = {
      id: 'article-1',
      categoryId: 'orders',
      title: 'Where is my order?',
      summary: 'Track it.',
      version: 2,
      publishedAt: '2026-10-01T00:00:00.000Z',
    };
    expect(
      mapHelpCategories({
        data: {
          items: [
            {
              id: 'orders',
              icon: 'package',
              title: 'Orders',
              subtitle: 'Order help',
              articles: [summary],
            },
          ],
        },
      })[0].articles[0],
    ).toMatchObject({ question: 'Where is my order?', version: 2 });
    expect(
      mapHelpSearch({ data: { items: [summary], query: 'order', total: 1 } }).items[0].answer,
    ).toBe('Track it.');
    expect(
      mapHelpArticle({ data: { ...summary, body: 'Open My Orders.', viewerFeedback: null } }),
    ).toMatchObject({ question: 'Where is my order?', answer: 'Open My Orders.' });
  });
});
