import { AxiosError } from 'axios';
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
        summary: 'Review tracking first, then chat with support from the order.',
        body: 'Check the shipment timeline for a revised estimate. If the promised date has passed, open the order, choose Get Help and chat with support so the fulfilment team can investigate.',
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
        body: 'A failed payment debit is normally reversed by the bank. Share your payment reference when you chat with support if the bank deadline shown in your statement has passed.',
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
let messageCounter = 1;
let chat; // the customer's open chat, or null
const chatSummary = ({ messages, ...summary }) => summary;
export const resetCustomerSupportFixture = () => {
  messageCounter = 1;
  chat = null;
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
export const customerSupportFixtureAdapter = async config => {
  await wait();
  if (config.url === '/support/channels' && config.method === 'get') {
    return response(config, {
      data: {
        availabilityLabel: 'Our team is available 09:00 to 21:00. Leave a message any time and we will reply.',
        channels: [
          { id: 'chat', type: 'CHAT', label: 'Live chat', description: 'Message our support team', href: 'arise://support/chat', enabled: true },
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
  if (config.url === '/support/chat' && config.method === 'get') return response(config, { data: chat });
  if (config.url === '/support/chat/read' && config.method === 'post') {
    if (chat) chat.unreadCount = 0;
    return response(config, { data: chat });
  }
  if (config.url === '/support/chats' && config.method === 'get')
    return response(config, { data: { items: chat ? [chatSummary(chat)] : [], nextCursor: null } });
  const chatMatch = config.url?.match(/^\/support\/chats\/([^/]+)$/);
  if (chatMatch && config.method === 'get') {
    if (!chat || chat.id !== decodeURIComponent(chatMatch[1]))
      return reject(config, 404, 'NOT_FOUND', 'That chat was not found.');
    return response(config, { data: chat });
  }
  if (config.url === '/support/chat/messages' && config.method === 'post') {
    const body = config.data?.body?.trim() || '',
      attachments = config.data?.attachments || [];
    if (!body && !attachments.length) return reject(config, 422, 'MESSAGE_REQUIRED', 'Write a message or add a photo.');
    const now = new Date().toISOString();
    chat ??= { id: 'chat-1', status: 'OPEN', orderId: config.data.orderId ?? null, createdAt: now, unreadCount: 0, messages: [] };
    chat.messages.push({
      id: `message-${messageCounter++}`,
      authorType: 'CUSTOMER',
      authorDisplayName: 'You',
      body,
      attachments: attachments.map(id => ({ id, url: `https://example.invalid/${id}` })),
      createdAt: now,
    });
    chat.lastMessageAt = now;
    chat.lastMessagePreview = body || 'Photo';
    return response(config, { data: chat }, 201);
  }
  return reject(
    config,
    501,
    'FIXTURE_NOT_IMPLEMENTED',
    `No fixture exists for ${config.method?.toUpperCase()} ${config.url}.`,
  );
};
