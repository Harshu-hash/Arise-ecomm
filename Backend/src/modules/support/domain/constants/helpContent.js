// The Help Center's categories and articles. Bump an article's version when its text changes.
const publishedAt = '2026-10-01T00:00:00.000Z';

export const HELP_CATEGORIES = [
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
      },
      {
        id: 'help-order-delay',
        categoryId: 'orders',
        title: 'What should I do if delivery is delayed?',
        summary: 'Review tracking first, then chat with support from the order.',
        body: 'Check the shipment timeline for a revised estimate. If the promised date has passed, open the order, choose Get Help and chat with support so the fulfilment team can investigate.',
        version: 2,
        publishedAt,
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
      },
      {
        id: 'help-refund-time',
        categoryId: 'payments',
        title: 'How long do refunds take?',
        summary: 'Timing depends on the refund destination.',
        body: 'The order or return detail shows the authoritative refund status. Bank processing begins after the refund is initiated and timing varies by payment method.',
        version: 3,
        publishedAt,
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
      },
      {
        id: 'help-account-delete',
        categoryId: 'account',
        title: 'How does account deletion work?',
        summary: 'Eligibility depends on account blockers.',
        body: 'Open Privacy Center and choose Delete My Account. Active orders, returns, refunds, wallet balances or legal retention may block scheduling until resolved.',
        version: 2,
        publishedAt,
      },
    ],
  },
];