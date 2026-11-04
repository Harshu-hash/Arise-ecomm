import {
  mapHelpArticle,
  mapHelpCategories,
  mapHelpSearch,
  mapSubjects,
  mapTicketResponse,
  mapTickets,
} from './support.mapper';
const ticket = {
  id: 'HLP-1',
  subjectCode: 'ACCOUNT',
  subjectLabel: 'Account help',
  description: 'I need help with my account.',
  status: 'OPEN',
  orderId: null,
  createdAt: '2026-11-01T08:00:00.000Z',
  updatedAt: '2026-11-01T08:00:00.000Z',
  firstResponseDueAt: '2026-11-01T12:00:00.000Z',
  resolutionDueAt: '2026-11-04T08:00:00.000Z',
  canReply: true,
  messages: [
    {
      id: 'message-1',
      authorType: 'CUSTOMER',
      authorDisplayName: 'You',
      body: 'I need help with my account.',
      attachmentMediaIds: [],
      createdAt: '2026-11-01T08:00:00.000Z',
    },
  ],
};
describe('support mappers', () => {
  it('maps admin-managed subjects', () => {
    expect(
      mapSubjects({
        data: {
          items: [
            {
              code: 'ACCOUNT',
              label: 'Account help',
              requiresOrder: false,
              allowsAttachments: true,
            },
          ],
        },
      }),
    ).toHaveLength(1);
  });
  it('maps ticket status and public messages', () => {
    expect(mapTicketResponse({ data: ticket })).toMatchObject({
      statusLabel: 'Open',
      updates: [{ author: 'You', text: 'I need help with my account.' }],
    });
  });
  it('maps paginated ticket lists', () => {
    expect(mapTickets({ data: { items: [ticket], total: 1, nextCursor: null } }).items[0].id).toBe(
      'HLP-1',
    );
  });
  it('rejects unknown ticket states', () => {
    expect(() => mapTicketResponse({ data: { ...ticket, status: 'UNKNOWN' } })).toThrow();
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
