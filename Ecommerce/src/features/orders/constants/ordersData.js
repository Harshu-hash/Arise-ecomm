// Mock order data for the customer order-history/detail/tracking flow.
// Mirrors the shape used by src/features/support/constants/helpData.js#MOCK_ORDERS
// so support screens (CancelOrder, ReturnReplace, OrderIssue) stay compatible.

export const ORDER_STATUS = {
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  OUT_FOR_DELIVERY: 'Out for Delivery',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  RETURNED: 'Returned',
};

export const ORDER_JOURNEY_STEPS = [
  'Order placed',
  'Shop preparing',
  'Finding delivery partner',
  'Delivery partner assigned',
  'Out for delivery',
  'Delivered',
];

export const MOCK_ORDERS = [
  {
    id: 'ORD-84920',
    placedOn: '18 Aug 2026, 4:12 PM',
    date: '18 Aug 2026',
    status: ORDER_STATUS.OUT_FOR_DELIVERY,
    currentStep: 4,
    canCancel: true,
    canReturn: false,
    paymentMethod: 'UPI',
    deliveryCode: '4829',
    address: {
      label: 'Home',
      name: 'Harshvardhan Panchal',
      line: '221B Baker Street, Sector 12, Near City Mall',
      cityLine: 'Ahmedabad, Gujarat - 380015',
      phone: '+91 98765 43210',
    },
    items: [
      {
        id: 'c1',
        name: 'boAt Airdopes 141 Bluetooth Truly Wireless Earbuds',
        variant: 'Bold Black',
        qty: 1,
        price: 1299,
        mrp: 2490,
        image: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=400&q=80',
      },
    ],
    priceDetails: {
      itemTotal: 1299,
      deliveryFee: 0,
      platformFee: 5,
      discount: 0,
      grandTotal: 1304,
    },
    get name() {
      return this.items[0].name;
    },
    get image() {
      return this.items[0].image;
    },
    get price() {
      return this.priceDetails.grandTotal;
    },
  },
  {
    id: 'ORD-77213',
    placedOn: '02 Jul 2026, 11:05 AM',
    date: '02 Jul 2026',
    status: ORDER_STATUS.DELIVERED,
    currentStep: 6,
    canCancel: false,
    canReturn: true,
    paymentMethod: 'Cash on Delivery',
    deliveryCode: '7710',
    address: {
      label: 'Home',
      name: 'Harshvardhan Panchal',
      line: '221B Baker Street, Sector 12, Near City Mall',
      cityLine: 'Ahmedabad, Gujarat - 380015',
      phone: '+91 98765 43210',
    },
    items: [
      {
        id: 'p2',
        name: 'Samsung Galaxy M14 5G (ICY Silver, 128 GB)',
        variant: 'ICY Silver, 128GB',
        qty: 1,
        price: 12999,
        mrp: 15999,
        image: 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&w=400&q=80',
      },
    ],
    priceDetails: {
      itemTotal: 12999,
      deliveryFee: 0,
      platformFee: 5,
      discount: 300,
      grandTotal: 12704,
    },
    get name() {
      return this.items[0].name;
    },
    get image() {
      return this.items[0].image;
    },
    get price() {
      return this.priceDetails.grandTotal;
    },
  },
  {
    id: 'ORD-65510',
    placedOn: '25 Jun 2026, 6:40 PM',
    date: '25 Jun 2026',
    status: ORDER_STATUS.DELIVERED,
    currentStep: 6,
    canCancel: false,
    canReturn: true,
    paymentMethod: 'Credit Card',
    deliveryCode: '2201',
    address: {
      label: 'Work',
      name: 'Harshvardhan Panchal',
      line: '4th Floor, Tech Park One, SG Highway',
      cityLine: 'Ahmedabad, Gujarat - 380054',
      phone: '+91 98765 43210',
    },
    items: [
      {
        id: 'c1b',
        name: 'LIFE FIT radhe radhe Diary Collection Notebook | Free Stickers A5 Diary Unruled 150 Pages',
        variant: 'Multicolour',
        qty: 1,
        price: 298,
        mrp: 795,
        image: 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=400&q=80',
      },
    ],
    priceDetails: {
      itemTotal: 298,
      deliveryFee: 0,
      platformFee: 5,
      discount: 0,
      grandTotal: 303,
    },
    get name() {
      return this.items[0].name;
    },
    get image() {
      return this.items[0].image;
    },
    get price() {
      return this.priceDetails.grandTotal;
    },
  },
  {
    id: 'ORD-51108',
    placedOn: '10 May 2026, 9:22 AM',
    date: '10 May 2026',
    status: ORDER_STATUS.CANCELLED,
    currentStep: 1,
    canCancel: false,
    canReturn: false,
    paymentMethod: 'UPI',
    deliveryCode: null,
    address: {
      label: 'Home',
      name: 'Harshvardhan Panchal',
      line: '221B Baker Street, Sector 12, Near City Mall',
      cityLine: 'Ahmedabad, Gujarat - 380015',
      phone: '+91 98765 43210',
    },
    items: [
      {
        id: 'sg2',
        name: 'Floral Print Shorts',
        variant: 'M',
        qty: 1,
        price: 349,
        mrp: 899,
        image: 'https://images.unsplash.com/photo-1591369822096-ffd140ec948f?auto=format&fit=crop&w=400&q=80',
      },
    ],
    priceDetails: {
      itemTotal: 349,
      deliveryFee: 0,
      platformFee: 5,
      discount: 0,
      grandTotal: 354,
    },
    get name() {
      return this.items[0].name;
    },
    get image() {
      return this.items[0].image;
    },
    get price() {
      return this.priceDetails.grandTotal;
    },
  },
];

export const STATUS_FILTERS = ['All', 'Processing', 'Delivered', 'Cancelled'];

export const getOrderStatusGroup = (status) => {
  if (status === ORDER_STATUS.DELIVERED) return 'Delivered';
  if (status === ORDER_STATUS.CANCELLED || status === ORDER_STATUS.RETURNED) return 'Cancelled';
  return 'Processing';
};

export const PAYMENT_METHODS = [
  { id: 'upi', icon: 'smartphone', title: 'UPI', subtitle: 'Pay by any UPI app' },
  { id: 'card', icon: 'credit-card', title: 'Credit / Debit Card', subtitle: 'Visa, Mastercard, RuPay & more' },
  { id: 'netbanking', icon: 'globe', title: 'Net Banking', subtitle: 'All major banks supported' },
  { id: 'wallet', icon: 'gift', title: 'Wallet', subtitle: 'Balance: ₹500' },
  { id: 'cod', icon: 'truck', title: 'Cash on Delivery', subtitle: 'Pay when your order arrives' },
];
