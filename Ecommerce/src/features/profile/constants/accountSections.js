export const ACCOUNT_SECTIONS = [
  {
    title: 'Account Settings',
    rows: [
      { id: 'edit', icon: 'user', label: 'Edit Profile', route: 'EditProfile' },
      { id: 'orders', icon: 'package', label: 'My Orders', route: 'MyOrders' },
      { id: 'cards', icon: 'credit-card', label: 'Saved Credit / Debit & Gift Cards', route: 'SavedCards' },
      { id: 'addresses', icon: 'map-pin', label: 'Saved Addresses', route: 'SavedAddresses' },
      { id: 'privacy', icon: 'shield', label: 'Privacy Center', route: 'PrivacyCenter' },
      { id: 'language', icon: 'globe', label: 'Language', route: 'Language' },
    ],
  },
  {
    title: 'My Activity',
    rows: [
      { id: 'reviews', icon: 'edit-2', label: 'Reviews', route: 'Reviews' },
      { id: 'qa', icon: 'message-square', label: 'Questions & Answers', route: 'QuestionsAnswers' },
    ],
  },
  {
    title: 'Earn with Flipkart',
    rows: [
      { id: 'sell', icon: 'shopping-bag', label: 'Sell on Flipkart', route: 'SellOnFlipkart' },
      { id: 'referral', icon: 'gift', label: 'Refer & Earn', route: 'Referral' },
    ],
  },
  {
    title: 'Feedback & Information',
    rows: [
      { id: 'rate', icon: 'star', label: 'Rate Us', route: 'RateUs' },
      { id: 'about', icon: 'info', label: 'About Flipkart', route: 'About' },
      { id: 'terms', icon: 'file-text', label: 'Terms & Conditions', route: 'TermsConditions' },
    ],
  },
];
