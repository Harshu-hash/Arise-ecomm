export const HELP_CATEGORIES = [
  {
    id: 'orders',
    icon: 'package',
    title: 'Orders & Shipping',
    subtitle: 'Track, delay, address change',
    articles: [
      {
        id: 'o1',
        question: 'Where is my order?',
        answer:
          'You can track your order in real time from the Orders section. Go to My Orders, select the order, and tap "Track Order" to see live status, courier details, and estimated delivery date. You will also receive SMS and app notifications at every stage of the delivery.',
      },
      {
        id: 'o2',
        question: 'How do I track my order?',
        answer:
          'Open the app, go to Account > Orders, and select the order you want to track. You will see a step-by-step timeline including Order Confirmed, Packed, Shipped, Out for Delivery, and Delivered, along with the delivery partner’s live location where available.',
      },
      {
        id: 'o3',
        question: 'My order is delayed, what do I do?',
        answer:
          'Delays can happen due to weather, logistics disruptions, or regional restrictions. Check the latest status on the tracking page first. If the delivery date has passed by more than 2 days, you can raise a ticket from this order and our support team will investigate and update you within 24 hours.',
      },
      {
        id: 'o4',
        question: 'Can I change my delivery address after placing an order?',
        answer:
          'Address changes are only possible before the order is packed for shipping. Go to My Orders, select the order, and look for "Edit Address". Once the item is shipped, the address cannot be changed, but you can cancel the order and place a new one with the correct address.',
      },
      {
        id: 'o5',
        question: 'Can I change the delivery date or time slot?',
        answer:
          'For select categories, you can choose a preferred delivery slot at checkout. Once an order is placed, the slot generally cannot be changed, but you can contact support to request a reschedule if the courier partner supports it in your area.',
      },
    ],
  },
  {
    id: 'payments',
    icon: 'credit-card',
    title: 'Payments & Refunds',
    subtitle: 'Failed payments, refund status',
    articles: [
      {
        id: 'p1',
        question: 'Payment failed but amount was deducted',
        answer:
          'If your payment failed but the amount was debited from your account, it is usually auto-reversed by your bank within 5-7 business days. If the amount hasn’t been credited back after 7 days, raise a ticket with your transaction ID and bank statement and our payments team will assist you.',
      },
      {
        id: 'p2',
        question: 'How long do refunds take?',
        answer:
          'Refunds to UPI and wallets are typically processed within 24-48 hours. Refunds to credit/debit cards take 5-7 business days, and refunds to net banking accounts take 3-5 business days after the return is picked up and quality-checked.',
      },
      {
        id: 'p3',
        question: 'Which payment methods are accepted?',
        answer:
          'We accept UPI, credit and debit cards, net banking, wallets, EMI options on select cards, and Cash on Delivery for eligible orders and locations.',
      },
      {
        id: 'p4',
        question: 'Is it safe to save my card details?',
        answer:
          'Yes. All card details are tokenised and encrypted as per RBI guidelines. We never store your CVV, and every payment is processed through PCI-DSS compliant gateways.',
      },
    ],
  },
  {
    id: 'returns',
    icon: 'refresh-ccw',
    title: 'Returns, Exchange & Refund',
    subtitle: 'Return policy, damaged items',
    articles: [
      {
        id: 'r1',
        question: 'What is the return policy?',
        answer:
          'Most products are eligible for return within 7-10 days of delivery, depending on the category. Some categories like innerwear, perishables, and personal care items are non-returnable for hygiene reasons. Check the product page for the exact return window before purchasing.',
      },
      {
        id: 'r2',
        question: 'How do I return a product?',
        answer:
          'Go to My Orders, select the item, and tap "Return or Replace Item". Choose a reason, select refund or replacement, confirm your pickup address, and schedule a pickup. Our delivery partner will collect the item from your doorstep within 2-3 days.',
      },
      {
        id: 'r3',
        question: 'Item received is damaged or defective',
        answer:
          'We’re sorry for the inconvenience. Please raise a return request within 48 hours of delivery with photos of the damaged item and packaging. This helps us process a faster replacement or full refund without requiring the item to be shipped back in some cases.',
      },
      {
        id: 'r4',
        question: 'I received the wrong item',
        answer:
          'Please select "Wrong Item Delivered" under Return or Replace on your order. Our team will arrange a free pickup of the incorrect item and ship the correct one, or issue a full refund if the product is out of stock.',
      },
      {
        id: 'r5',
        question: 'How do I check my return/refund status?',
        answer:
          'Go to My Orders and select the returned item. You will see the current stage: Pickup Scheduled, Item Picked Up, Quality Check, Refund Initiated, or Refund Completed, along with expected dates for each stage.',
      },
    ],
  },
  {
    id: 'account',
    icon: 'user',
    title: 'Account & Profile',
    subtitle: 'Login, password, profile updates',
    articles: [
      {
        id: 'a1',
        question: 'How do I update my profile details?',
        answer:
          'Go to Account Settings > Edit Profile to update your name, email, mobile number, or gender. Some changes to your registered mobile number may require OTP verification for security.',
      },
      {
        id: 'a2',
        question: 'I forgot my password',
        answer:
          'On the login screen, tap "Forgot Password" and enter your registered email or mobile number. You’ll receive an OTP or reset link to create a new password.',
      },
      {
        id: 'a3',
        question: 'How do I delete my account?',
        answer:
          'Go to Account Settings > Privacy Center > Delete My Account. Please note this action is permanent and will remove your order history, saved addresses, cards, and reviews. This cannot be undone.',
      },
      {
        id: 'a4',
        question: 'How do I manage notification preferences?',
        answer:
          'Notification preferences can be managed from your device settings for this app, controlling order updates, offers, and promotional alerts separately.',
      },
    ],
  },
  {
    id: 'plus',
    icon: 'award',
    title: 'Membership & Rewards',
    subtitle: 'Plus benefits, SuperCoins',
    articles: [
      {
        id: 'm1',
        question: 'What are the benefits of a Plus membership?',
        answer:
          'Plus members enjoy free faster delivery, early access to sales, exclusive deals, and dedicated customer support with priority resolution.',
      },
      {
        id: 'm2',
        question: 'How do I earn and redeem reward coins?',
        answer:
          'You earn reward coins on eligible purchases, reviews, and app engagement. Coins can be redeemed at checkout for instant discounts, subject to the minimum order value shown in your Wallet.',
      },
    ],
  },
  {
    id: 'seller',
    icon: 'shield',
    title: 'Product & Seller Issues',
    subtitle: 'Quality complaints, report seller',
    articles: [
      {
        id: 's1',
        question: 'How do I report a seller?',
        answer:
          'Go to the order details page and tap "Report a Problem". Choose "Report Seller", describe the issue, and our marketplace quality team will review and take appropriate action within 3-5 business days.',
      },
      {
        id: 's2',
        question: 'Product quality does not match the description',
        answer:
          'If the product you received doesn’t match the listing, raise a return request under "Item Not as Described" with photos. This is eligible for a full refund or replacement, and helps us take action against misleading listings.',
      },
      {
        id: 's3',
        question: 'How do sellers get verified?',
        answer:
          'All sellers undergo GSTIN and bank account verification before they can list products. We also continuously monitor seller ratings, return rates, and customer complaints to maintain marketplace quality.',
      },
    ],
  },
];

export const CANCEL_REASONS = [
  'Ordered by mistake',
  'Found a better price elsewhere',
  'Item no longer needed',
  'Delivery time is too long',
  'Other',
];

export const RETURN_REASONS = [
  'Item is damaged or defective',
  'Wrong item delivered',
  'Item not as described',
  'Size/fit issue',
  'Changed my mind',
  'Other',
];

export const TICKET_SUBJECTS = [
  { id: 'delivery', icon: 'truck', label: 'Delivery Issue' },
  { id: 'payment', icon: 'credit-card', label: 'Payment Issue' },
  { id: 'product', icon: 'package', label: 'Product Quality' },
  { id: 'refund', icon: 'rotate-ccw', label: 'Refund Query' },
  { id: 'account', icon: 'user', label: 'Account Issue' },
  { id: 'other', icon: 'more-horizontal', label: 'Other' },
];

export const MOCK_ORDERS = [
  {
    id: 'ORD-84920',
    name: 'boAt Airdopes 141 Bluetooth Truly Wireless Earbuds',
    image: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=400&q=80',
    price: 1299,
    date: '18 Aug 2026',
    status: 'Out for Delivery',
    canCancel: true,
    canReturn: false,
  },
  {
    id: 'ORD-77213',
    name: 'Samsung Galaxy M14 5G (ICY Silver, 128 GB)',
    image: 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&w=400&q=80',
    price: 12999,
    date: '02 Jul 2026',
    status: 'Delivered',
    canCancel: false,
    canReturn: true,
  },
  {
    id: 'ORD-65510',
    name: 'LIFE FIT Diary Collection Notebook A5 Unruled 150 Pages',
    image: 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=400&q=80',
    price: 298,
    date: '25 Jun 2026',
    status: 'Delivered',
    canCancel: false,
    canReturn: true,
  },
];

export const MOCK_TICKETS = [
  {
    id: 'HLP-30442',
    subject: 'Delivery Issue',
    orderId: 'ORD-84920',
    status: 'In Progress',
    createdOn: '19 Aug 2026',
    description: 'My order is showing out for delivery for 2 days now with no update.',
    updates: [
      { id: 't1', author: 'You', text: 'My order is showing out for delivery for 2 days now with no update.', date: '19 Aug, 10:14 AM' },
      { id: 't2', author: 'Support Agent', text: 'We’re sorry for the delay. We’ve escalated this to our logistics partner and expect delivery within 24 hours.', date: '19 Aug, 11:02 AM' },
    ],
  },
  {
    id: 'HLP-29187',
    subject: 'Refund Query',
    orderId: 'ORD-65510',
    status: 'Resolved',
    createdOn: '27 Jun 2026',
    description: 'Refund for returned notebook not received after 6 days.',
    updates: [
      { id: 't3', author: 'You', text: 'Refund for returned notebook not received after 6 days.', date: '27 Jun, 09:20 AM' },
      { id: 't4', author: 'Support Agent', text: 'We’ve checked with our payments team, the refund of ₹298 was processed today and should reflect within 3-5 business days.', date: '27 Jun, 03:45 PM' },
      { id: 't5', author: 'You', text: 'Got it, thank you!', date: '28 Jun, 09:02 AM' },
    ],
  },
];
