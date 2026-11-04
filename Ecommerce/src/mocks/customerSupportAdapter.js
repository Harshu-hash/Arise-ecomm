import { AxiosError } from 'axios';
import { getMediaFixture } from './customerMediaAdapter';
import { getOrderFixture } from './customerOrdersAdapter';
const LATENCY_MS = 220;
const publishedAt = '2026-10-01T00:00:00.000Z';
const helpCategories = [
  {
    id: 'orders',
    icon: 'package',
    title: 'Orders & Shipping',
    subtitle: 'Tracking, delays and delivery changes',
    articles: [
      {
        id: 'help-order-track',
        categoryId: 'orders',
        title: 'Where is my order?',
        summary: 'Track the latest courier status from My Orders.',
        body: 'Open My Orders, select the order, and choose Track Shipment. The app displays only courier-supplied events, delivery attempts and estimated arrival information when available.',
        version: 2,
        publishedAt,
        viewerFeedback: null,
      },
      {
        id: 'help-order-delay',
        categoryId: 'orders',
        title: 'What should I do if delivery is delayed?',
        summary: 'Review tracking first, then raise an order-linked ticket.',
        body: 'Check the shipment timeline for a revised estimate. If the promised date has passed, open the order and raise a support ticket so the fulfilment team can investigate.',
        version: 2,
        publishedAt,
        viewerFeedback: null,
      },
    ],
  },
  {
    id: 'payments',
    icon: 'credit-card',
    title: 'Payments & Refunds',
    subtitle: 'Failed payments and refund timing',
    articles: [
      {
        id: 'help-payment-failed',
        categoryId: 'payments',
        title: 'Payment failed but money was deducted',
        summary: 'Banks usually reverse failed debits automatically.',
        body: 'A failed payment debit is normally reversed by the bank. Use your payment reference when raising a ticket if the bank deadline shown in your statement has passed.',
        version: 3,
        publishedAt,
        viewerFeedback: null,
      },
      {
        id: 'help-refund-time',
        categoryId: 'payments',
        title: 'How long do refunds take?',
        summary: 'Timing depends on the refund destination.',
        body: 'The order or return detail shows the authoritative refund status. Bank processing begins after the refund is initiated and timing varies by payment method.',
        version: 3,
        publishedAt,
        viewerFeedback: null,
      },
    ],
  },
  {
    id: 'returns',
    icon: 'refresh-ccw',
    title: 'Returns & Replacements',
    subtitle: 'Eligibility, pickup and refund status',
    articles: [
      {
        id: 'help-return-create',
        categoryId: 'returns',
        title: 'How do I return an item?',
        summary: 'Start from an eligible delivered order.',
        body: 'Open the delivered order, choose Return or Replace, select the server-provided reason and resolution, upload evidence when required, and confirm the pickup address.',
        version: 2,
        publishedAt,
        viewerFeedback: null,
      },
    ],
  },
  {
    id: 'account',
    icon: 'user',
    title: 'Account & Privacy',
    subtitle: 'Profile, preferences and privacy requests',
    articles: [
      {
        id: 'help-profile-update',
        categoryId: 'account',
        title: 'How do I update my profile?',
        summary: 'Use Edit Profile from Account Settings.',
        body: 'Name, gender and profile image changes save immediately. A new email address or phone number remains pending until its verification challenge succeeds.',
        version: 2,
        publishedAt,
        viewerFeedback: null,
      },
      {
        id: 'help-account-delete',
        categoryId: 'account',
        title: 'How does account deletion work?',
        summary: 'Eligibility depends on account blockers.',
        body: 'Open Privacy Center and choose Delete My Account. Active orders, returns, refunds, wallet balances or legal retention may block scheduling until resolved.',
        version: 2,
        publishedAt,
        viewerFeedback: null,
      },
    ],
  },
];
let counter = 103;
let messageCounter = 4;
const subjects = [
  {
    code: 'ORDER_STATUS',
    label: 'Order status or delivery',
    requiresOrder: true,
    allowsAttachments: true,
  },
  {
    code: 'PAYMENT_REFUND',
    label: 'Payment or refund',
    requiresOrder: true,
    allowsAttachments: true,
  },
  {
    code: 'RETURN_ISSUE',
    label: 'Return or replacement',
    requiresOrder: true,
    allowsAttachments: true,
  },
  { code: 'ACCOUNT', label: 'Account or privacy', requiresOrder: false, allowsAttachments: true },
  { code: 'OTHER', label: 'Something else', requiresOrder: false, allowsAttachments: true },
];
let tickets;
const initial = () =>
  new Map([
    [
      'HLP-101',
      {
        id: 'HLP-101',
        subjectCode: 'ORDER_STATUS',
        subjectLabel: 'Order status or delivery',
        description: 'My order status has not changed.',
        status: 'IN_PROGRESS',
        orderId: 'ORD-84920',
        createdAt: '2026-11-01T08:00:00.000Z',
        updatedAt: '2026-11-02T09:00:00.000Z',
        firstResponseDueAt: '2026-11-01T12:00:00.000Z',
        resolutionDueAt: '2026-11-04T08:00:00.000Z',
        canReply: true,
        messages: [
          {
            id: 'message-1',
            authorType: 'CUSTOMER',
            authorDisplayName: 'You',
            body: 'My order status has not changed.',
            attachmentMediaIds: [],
            createdAt: '2026-11-01T08:00:00.000Z',
          },
          {
            id: 'message-2',
            authorType: 'AGENT',
            authorDisplayName: 'Support agent',
            body: 'We are checking this with the fulfilment team.',
            attachmentMediaIds: [],
            createdAt: '2026-11-02T09:00:00.000Z',
          },
        ],
      },
    ],
    [
      'HLP-102',
      {
        id: 'HLP-102',
        subjectCode: 'ACCOUNT',
        subjectLabel: 'Account or privacy',
        description: 'I need help understanding my privacy export.',
        status: 'RESOLVED',
        orderId: null,
        createdAt: '2026-10-20T08:00:00.000Z',
        updatedAt: '2026-10-21T09:00:00.000Z',
        firstResponseDueAt: null,
        resolutionDueAt: null,
        canReply: false,
        messages: [
          {
            id: 'message-3',
            authorType: 'SYSTEM',
            authorDisplayName: 'System',
            body: 'This ticket was resolved after the export instructions were provided.',
            attachmentMediaIds: [],
            createdAt: '2026-10-21T09:00:00.000Z',
          },
        ],
      },
    ],
  ]);
export const resetCustomerSupportFixture = () => {
  counter = 103;
  messageCounter = 4;
  tickets = initial();
};
resetCustomerSupportFixture();
const wait = () => new Promise(resolve => setTimeout(resolve, LATENCY_MS));
const response = (config, data, status = 200) => ({
  data,
  status,
  statusText: status < 400 ? 'OK' : 'Error',
  headers: { 'content-type': 'application/json' },
  config,
  request: null,
});
const reject = (config, status, code, message) => {
  throw new AxiosError(
    message,
    code,
    config,
    null,
    response(config, { error: { code, message } }, status),
  );
};
const sorted = () =>
  [...tickets.values()].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
export const customerSupportFixtureAdapter = async config => {
  await wait();
  if (config.url === '/support/channels' && config.method === 'get') {
    return response(config, {
      data: {
        availabilityLabel: 'Support hours and response times are shown per channel',
        channels: [
          { id: 'phone', type: 'PHONE', label: 'Call us', description: 'Customer care', href: 'tel:+911800000000', enabled: true },
          { id: 'email', type: 'EMAIL', label: 'Email us', description: 'support@arise.invalid', href: 'mailto:support@arise.invalid', enabled: true },
        ],
      },
    });
  }
  if (config.url === '/help/categories' && config.method === 'get')
    return response(config, {
      data: {
        items: helpCategories.map(category => ({
          ...category,
          articles: category.articles.map(({ body, viewerFeedback, ...article }) => article),
        })),
      },
    });
  const helpCategoryMatch = config.url?.match(/^\/help\/categories\/([^/]+)$/);
  if (helpCategoryMatch && config.method === 'get') {
    const category = helpCategories.find(
      item => item.id === decodeURIComponent(helpCategoryMatch[1]),
    );
    if (!category)
      return reject(config, 404, 'HELP_CATEGORY_NOT_FOUND', 'This help category was not found.');
    return response(config, {
      data: {
        ...category,
        articles: category.articles.map(({ body, viewerFeedback, ...article }) => article),
      },
    });
  }
  const feedbackMatch = config.url?.match(/^\/help\/articles\/([^/]+)\/feedback$/);
  if (feedbackMatch && config.method === 'put') {
    const article = helpCategories
      .flatMap(item => item.articles)
      .find(item => item.id === decodeURIComponent(feedbackMatch[1]));
    if (!article)
      return reject(config, 404, 'HELP_ARTICLE_NOT_FOUND', 'This help article was not found.');
    if (typeof config.data?.helpful !== 'boolean')
      return reject(config, 422, 'FEEDBACK_INVALID', 'Choose whether the article was helpful.');
    article.viewerFeedback = config.data.helpful ? 'HELPFUL' : 'NOT_HELPFUL';
    return response(config, { data: article });
  }
  const articleMatch = config.url?.match(/^\/help\/articles\/([^/]+)$/);
  if (articleMatch && config.method === 'get') {
    const article = helpCategories
      .flatMap(item => item.articles)
      .find(item => item.id === decodeURIComponent(articleMatch[1]));
    if (!article)
      return reject(config, 404, 'HELP_ARTICLE_NOT_FOUND', 'This help article was not found.');
    return response(config, { data: article });
  }
  if (config.url === '/help/search' && config.method === 'get') {
    const query = String(config.params?.query || '')
        .trim()
        .toLowerCase(),
      items = helpCategories
        .flatMap(item => item.articles)
        .filter(
          item =>
            !query || `${item.title} ${item.summary} ${item.body}`.toLowerCase().includes(query),
        )
        .map(({ body, viewerFeedback, ...article }) => article);
    return response(config, { data: { items, query, total: items.length } });
  }
  if (config.url === '/support/subjects' && config.method === 'get')
    return response(config, { data: { items: subjects } });
  if (config.url === '/support/tickets' && config.method === 'get') {
    const items = sorted(),
      offset = Number(config.params?.cursor || 0),
      limit = Math.min(Number(config.params?.limit || 20), 50);
    return response(config, {
      data: {
        items: items.slice(offset, offset + limit),
        total: items.length,
        nextCursor: offset + limit < items.length ? String(offset + limit) : null,
      },
    });
  }
  if (config.url === '/support/tickets' && config.method === 'post') {
    const { subjectCode, description, orderId = null, attachmentMediaIds = [] } = config.data || {},
      subject = subjects.find(item => item.code === subjectCode);
    if (!subject) return reject(config, 422, 'SUBJECT_INVALID', 'Choose a valid support subject.');
    if (description?.trim().length < 10)
      return reject(
        config,
        422,
        'DESCRIPTION_REQUIRED',
        'Describe the issue using at least 10 characters.',
      );
    if (subject.requiresOrder && (!orderId || !getOrderFixture(orderId)))
      return reject(config, 422, 'ORDER_REQUIRED', 'Choose a valid order for this issue.');
    if (attachmentMediaIds.some(id => !getMediaFixture(id)))
      return reject(config, 422, 'ATTACHMENT_INVALID', 'Upload the attachment again.');
    const now = new Date(),
      id = `HLP-${counter++}`,
      message = {
        id: `message-${messageCounter++}`,
        authorType: 'CUSTOMER',
        authorDisplayName: 'You',
        body: description.trim(),
        attachmentMediaIds,
        createdAt: now.toISOString(),
      },
      ticket = {
        id,
        subjectCode,
        subjectLabel: subject.label,
        description: description.trim(),
        status: 'OPEN',
        orderId,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        firstResponseDueAt: new Date(now.getTime() + 4 * 3600000).toISOString(),
        resolutionDueAt: new Date(now.getTime() + 72 * 3600000).toISOString(),
        canReply: true,
        messages: [message],
      };
    tickets.set(id, ticket);
    return response(config, { data: ticket }, 201);
  }
  const replyMatch = config.url?.match(/^\/support\/tickets\/([^/]+)\/messages$/);
  if (replyMatch && config.method === 'post') {
    const ticket = tickets.get(decodeURIComponent(replyMatch[1]));
    if (!ticket)
      return reject(config, 404, 'TICKET_NOT_FOUND', 'This support ticket was not found.');
    if (!ticket.canReply)
      return reject(config, 409, 'TICKET_CLOSED', 'This ticket no longer accepts replies.');
    const body = config.data?.body?.trim(),
      attachmentMediaIds = config.data?.attachmentMediaIds || [];
    if (!body) return reject(config, 422, 'MESSAGE_REQUIRED', 'Write a reply.');
    if (attachmentMediaIds.some(id => !getMediaFixture(id)))
      return reject(config, 422, 'ATTACHMENT_INVALID', 'Upload the attachment again.');
    ticket.messages.push({
      id: `message-${messageCounter++}`,
      authorType: 'CUSTOMER',
      authorDisplayName: 'You',
      body,
      attachmentMediaIds,
      createdAt: new Date().toISOString(),
    });
    ticket.updatedAt = new Date().toISOString();
    return response(config, { data: ticket });
  }
  const detailMatch = config.url?.match(/^\/support\/tickets\/([^/]+)$/);
  if (detailMatch && config.method === 'get') {
    const ticket = tickets.get(decodeURIComponent(detailMatch[1]));
    if (!ticket)
      return reject(config, 404, 'TICKET_NOT_FOUND', 'This support ticket was not found.');
    return response(config, { data: ticket });
  }
  return reject(
    config,
    501,
    'FIXTURE_NOT_IMPLEMENTED',
    `No fixture exists for ${config.method?.toUpperCase()} ${config.url}.`,
  );
};
