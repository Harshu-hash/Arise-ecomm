// Flipkart "All Categories" data — left sidebar entries + per-category CMS-style right-pane sections.
// badgeVariant: 'buyNow' | 'notifyMe' | 'recent' | 'applyNow'

export const MAIN_SIDEBAR_CATEGORIES = [
  { id: 'foryou', name: 'For You', icon: 'shopping-bag' },
  { id: 'grocery', name: 'Grocery', image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=200&q=80' },
  { id: 'fashion', name: 'Fashion', image: 'https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?auto=format&fit=crop&w=200&q=80' },
  { id: 'mobiles', name: 'Mobiles', image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=200&q=80' },
  { id: 'appliances', name: 'Appliances', image: 'https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?auto=format&fit=crop&w=200&q=80' },
  { id: 'electronics', name: 'Electronics', image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=200&q=80' },
  { id: 'smartgadgets', name: 'Smart Gadgets', image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=200&q=80' },
  { id: 'home', name: 'Home', image: 'https://images.unsplash.com/photo-1567016432779-094069958ea5?auto=format&fit=crop&w=200&q=80' },
];

export const CATEGORY_CONTENT_MAP = {
  foryou: {
    heroBanner: null,
    sections: [
      {
        title: 'Popular Store',
        items: [
          { id: 'ps1', label: 'Value 365', image: 'https://images.unsplash.com/photo-1607083206968-13611e3d76db?auto=format&fit=crop&w=200&q=80' },
          { id: 'ps2', label: 'Celebrate Rakhi', image: 'https://images.unsplash.com/photo-1610824352934-c10d87b700cc?auto=format&fit=crop&w=200&q=80' },
          { id: 'ps3', label: 'Open now', image: 'https://images.unsplash.com/photo-1607082349566-187342175e2f?auto=format&fit=crop&w=200&q=80' },
          { id: 'ps4', label: 'Buses Launched!', image: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=200&q=80' },
          { id: 'ps5', label: 'Sneakers', image: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?auto=format&fit=crop&w=200&q=80', badge: 'RECENT..', badgeVariant: 'recent' },
          { id: 'ps6', label: 'Grocery', image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=200&q=80' },
        ],
      },
      {
        title: 'New & Upcoming Launches',
        items: [
          { id: 'nl1', label: 'Lava Virat V1 5G', image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=200&q=80', badge: 'BUY NOW', badgeVariant: 'buyNow' },
          { id: 'nl2', label: 'POCO M8x 5G', image: 'https://images.unsplash.com/photo-1592286927505-1def25115481?auto=format&fit=crop&w=200&q=80', badge: 'NOTIFY ME', badgeVariant: 'notifyMe' },
          { id: 'nl3', label: 'Pixel 11 Series', image: 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&w=200&q=80', badge: 'BUY NOW', badgeVariant: 'buyNow' },
          { id: 'nl4', label: 'Moto Pad 70', image: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?auto=format&fit=crop&w=200&q=80', badge: 'BUY NOW', badgeVariant: 'buyNow' },
          { id: 'nl5', label: 'HP OmniPad 12', image: 'https://images.unsplash.com/photo-1587614382346-4ec70e388b28?auto=format&fit=crop&w=200&q=80', badge: 'BUY NOW', badgeVariant: 'buyNow' },
          { id: 'nl6', label: 'Brave ARK', image: 'https://images.unsplash.com/photo-1587614203976-365c74645e83?auto=format&fit=crop&w=200&q=80', badge: 'NOTIFY ME', badgeVariant: 'notifyMe' },
          { id: 'nl7', label: 'POCO M8 Power 5G', image: 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&w=200&q=80', badge: 'BUY NOW', badgeVariant: 'buyNow' },
          { id: 'nl8', label: 'CMF Buds Neo', image: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=200&q=80', badge: 'NOTIFY ME', badgeVariant: 'notifyMe' },
        ],
        viewAll: true,
      },
    ],
  },

  fashion: {
    heroBanner: {
      title: 'Fashion',
      image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=500&q=80',
    },
    sections: [
      {
        title: 'In the Spotlight',
        items: [
          { id: 'sp1', label: 'New season', image: 'https://images.unsplash.com/photo-1544022613-e87ca75a784a?auto=format&fit=crop&w=200&q=80', badge: 'Autumn Winter \'26', badgeVariant: 'title' },
          { id: 'sp2', label: 'Shop Now', image: 'https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=200&q=80', badge: 'Festivals of India', badgeVariant: 'title' },
          { id: 'sp3', label: 'Korean Store', image: 'https://images.unsplash.com/photo-1552374196-c4e7ffc6e126?auto=format&fit=crop&w=200&q=80' },
          { id: 'sp4', label: 'Sneakers', image: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?auto=format&fit=crop&w=200&q=80', badge: 'RECEN..', badgeVariant: 'recent' },
          { id: 'sp5', label: 'Shop Now', image: 'https://images.unsplash.com/photo-1490114538077-0a7f8cb49891?auto=format&fit=crop&w=200&q=80', badge: 'Monsoon Store', badgeVariant: 'title' },
          { id: 'sp6', label: 'Sports store', image: 'https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=200&q=80' },
          { id: 'sp7', label: 'NIKE', image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=200&q=80', badge: 'BRAND DAYS', badgeVariant: 'buyNow' },
          { id: 'sp8', label: 'Trendy street', image: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=200&q=80' },
          { id: 'sp9', label: 'Flipkart pay Later', image: 'https://images.unsplash.com/photo-1553729459-efe14ef6055d?auto=format&fit=crop&w=200&q=80', badge: 'APPLY NOW', badgeVariant: 'applyNow' },
        ],
        viewAll: true,
      },
      {
        title: "Men's Clothing",
        items: [
          { id: 'mc1', label: 'T-Shirts', image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=200&q=80' },
          { id: 'mc2', label: 'Shirts', image: 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&w=200&q=80' },
          { id: 'mc3', label: 'Jeans', image: 'https://images.unsplash.com/photo-1542272604-787c3835535d?auto=format&fit=crop&w=200&q=80' },
        ],
      },
    ],
  },

  mobiles: {
    heroBanner: {
      title: 'Smartphones',
      image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=500&q=80',
    },
    sections: [
      {
        title: 'Upcoming Launches',
        items: [
          { id: 'ul1', label: 'Sale Is Live', image: 'https://images.unsplash.com/photo-1580910051074-3eb694886505?auto=format&fit=crop&w=200&q=80', badge: 'BUY NOW', badgeVariant: 'buyNow' },
          { id: 'ul2', label: 'Sale is Live', image: 'https://images.unsplash.com/photo-1592286927505-1def25115481?auto=format&fit=crop&w=200&q=80', badge: 'BUY NOW', badgeVariant: 'buyNow' },
          { id: 'ul3', label: 'Launch: 25th Aug, 12PM', image: 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&w=200&q=80', badge: 'NOTIFY ME', badgeVariant: 'notifyMe' },
          { id: 'ul4', label: 'Launch: 26th Aug, 12PM', image: 'https://images.unsplash.com/photo-1567581935884-3349723552ca?auto=format&fit=crop&w=200&q=80', badge: 'NOTIFY ME', badgeVariant: 'notifyMe' },
          { id: 'ul5', label: 'Sale: 27th Aug, 12PM', image: 'https://images.unsplash.com/photo-1598965675045-45c5e72c7d05?auto=format&fit=crop&w=200&q=80', badge: 'NOTIFY ME', badgeVariant: 'notifyMe' },
          { id: 'ul6', label: 'Coming Soon', image: 'https://images.unsplash.com/photo-1580910051074-3eb694886505?auto=format&fit=crop&w=200&q=80', badge: 'NOTIFY ME', badgeVariant: 'notifyMe' },
        ],
      },
      {
        title: 'In The Spotlight',
        items: [
          { id: 'is1', label: 'Flipkart SBI Credit Card', image: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=200&q=80', badge: 'APPLY NOW', badgeVariant: 'applyNow' },
          { id: 'is2', label: 'Live now', image: 'https://images.unsplash.com/photo-1556740738-b6a63e27c4df?auto=format&fit=crop&w=200&q=80' },
          { id: 'is3', label: 'Snapdragon', image: 'https://images.unsplash.com/photo-1580927752452-89d86da3fa0a?auto=format&fit=crop&w=200&q=80' },
          { id: 'is4', label: 'Flipkart Pay Later', image: 'https://images.unsplash.com/photo-1553729459-efe14ef6055d?auto=format&fit=crop&w=200&q=80' },
          { id: 'is5', label: 'Flipkart Axis Bank Credit', image: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=200&q=80', badge: 'APPLY NOW', badgeVariant: 'applyNow' },
        ],
      },
    ],
  },
};

const GENERIC_CONTENT = {
  heroBanner: null,
  sections: [
    {
      title: 'Popular in this category',
      items: [
        { id: 'g1', label: 'Explore', image: 'https://images.unsplash.com/photo-1607082349566-187342175e2f?auto=format&fit=crop&w=200&q=80' },
        { id: 'g2', label: 'New arrivals', image: 'https://images.unsplash.com/photo-1607083206968-13611e3d76db?auto=format&fit=crop&w=200&q=80' },
        { id: 'g3', label: 'Best sellers', image: 'https://images.unsplash.com/photo-1607082350899-7e105aa886ae?auto=format&fit=crop&w=200&q=80' },
      ],
    },
  ],
};

export const getCategoryContent = (categoryId) => CATEGORY_CONTENT_MAP[categoryId] || GENERIC_CONTENT;
