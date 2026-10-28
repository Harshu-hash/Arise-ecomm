// Mock search catalog + filter/sort config for the Flipkart-style search experience.
// Each product carries category + brand so SearchResultsScreen can filter/sort locally.

export const PRODUCT_CATALOG = [
  // Mobiles
  { id: 'm1', name: 'Samsung Galaxy M14 5G (ICY Silver, 128 GB)', brand: 'Samsung', category: 'Mobiles', image: 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&w=500&q=80', price: 12999, mrp: 16999, rating: 4.3, ratingCount: 3421, assured: true, deliveryDate: '26 Aug' },
  { id: 'm2', name: 'POCO M8x 5G (Cosmic Black, 128 GB)', brand: 'POCO', category: 'Mobiles', image: 'https://images.unsplash.com/photo-1592286927505-1def25115481?auto=format&fit=crop&w=500&q=80', price: 10999, mrp: 14999, rating: 4.1, ratingCount: 982, assured: true, deliveryDate: '27 Aug' },
  { id: 'm3', name: 'Google Pixel 11 (Obsidian, 256 GB)', brand: 'Google', category: 'Mobiles', image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=500&q=80', price: 64999, mrp: 74999, rating: 4.6, ratingCount: 512, assured: true, deliveryDate: '28 Aug' },
  { id: 'm4', name: 'Lava Virat V1 5G (Ocean Blue, 64 GB)', brand: 'Lava', category: 'Mobiles', image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=500&q=80', price: 8499, mrp: 10999, rating: 3.9, ratingCount: 214, assured: false, deliveryDate: '29 Aug' },

  // Electronics / Smart Gadgets
  { id: 'e1', name: 'boAt Airdopes 141 Bluetooth Truly Wireless Earbuds', brand: 'boAt', category: 'Electronics', image: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=500&q=80', price: 1299, mrp: 2490, rating: 4.2, ratingCount: 12840, assured: true, deliveryDate: '26 Aug' },
  { id: 'e2', name: 'Noise ColorFit Pro 4 Smartwatch', brand: 'Noise', category: 'Smart Gadgets', image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=500&q=80', price: 1799, mrp: 4999, rating: 4.0, ratingCount: 6721, assured: true, deliveryDate: '27 Aug' },
  { id: 'e3', name: 'boAt Stone 350 Portable Bluetooth Speaker', brand: 'boAt', category: 'Electronics', image: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&w=500&q=80', price: 899, mrp: 1999, rating: 4.1, ratingCount: 3980, assured: true, deliveryDate: '26 Aug' },
  { id: 'e4', name: 'Wireless Charging Pad 15W Fast Charger', brand: 'Portronics', category: 'Electronics', image: 'https://images.unsplash.com/photo-1622957461294-2ce6b6d33d20?auto=format&fit=crop&w=500&q=80', price: 499, mrp: 999, rating: 3.9, ratingCount: 845, assured: false, deliveryDate: '28 Aug' },
  { id: 'e5', name: 'HP OmniPad 12 Tablet (Grey, 128 GB, WiFi)', brand: 'HP', category: 'Smart Gadgets', image: 'https://images.unsplash.com/photo-1587614382346-4ec70e388b28?auto=format&fit=crop&w=500&q=80', price: 18999, mrp: 23999, rating: 4.2, ratingCount: 341, assured: true, deliveryDate: '30 Aug' },
  { id: 'e6', name: 'Fastrack Analog Wrist Watch for Men', brand: 'Fastrack', category: 'Smart Gadgets', image: 'https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=500&q=80', price: 1495, mrp: 2495, rating: 4.4, ratingCount: 1287, assured: true, deliveryDate: '27 Aug' },

  // Appliances
  { id: 'a1', name: 'Prestige 1.5L Electric Kettle', brand: 'Prestige', category: 'Appliances', image: 'https://images.unsplash.com/photo-1585515320310-259814833e62?auto=format&fit=crop&w=500&q=80', price: 799, mrp: 1499, rating: 4.3, ratingCount: 2210, assured: true, deliveryDate: '28 Aug' },
  { id: 'a2', name: 'Havells 400mm Table Fan', brand: 'Havells', category: 'Appliances', image: 'https://images.unsplash.com/photo-1618228498565-2d6d4de9c1ca?auto=format&fit=crop&w=500&q=80', price: 1899, mrp: 2799, rating: 4.0, ratingCount: 654, assured: false, deliveryDate: '29 Aug' },
  { id: 'a3', name: 'Philips Air Fryer HD9200', brand: 'Philips', category: 'Appliances', image: 'https://images.unsplash.com/photo-1626200419199-391ae4be7a41?auto=format&fit=crop&w=500&q=80', price: 5999, mrp: 8999, rating: 4.5, ratingCount: 1904, assured: true, deliveryDate: '30 Aug' },

  // Fashion
  { id: 'f1', name: 'Nike Revolution 6 Running Shoes for Men', brand: 'Nike', category: 'Fashion', image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=500&q=80', price: 2799, mrp: 4995, rating: 4.4, ratingCount: 894, assured: true, deliveryDate: '27 Aug' },
  { id: 'f2', name: 'Zeba Women Cotton A-Line Kurti', brand: 'Zeba', category: 'Fashion', image: 'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?auto=format&fit=crop&w=500&q=80', price: 349, mrp: 999, rating: 4.0, ratingCount: 512, assured: false, deliveryDate: '28 Aug' },
  { id: 'f3', name: "Men's Casual Cotton Shirt", brand: 'Roadster', category: 'Fashion', image: 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&w=500&q=80', price: 599, mrp: 1499, rating: 4.1, ratingCount: 1233, assured: true, deliveryDate: '27 Aug' },
  { id: 'f4', name: 'Wildcraft Water Resistant Travel Backpack', brand: 'Wildcraft', category: 'Fashion', image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=500&q=80', price: 1299, mrp: 2499, rating: 4.3, ratingCount: 2044, assured: true, deliveryDate: '29 Aug' },
  { id: 'f5', name: 'Wooden Shoe Rack Organizer, 5 Shelf', brand: 'Nilkamal', category: 'Home', image: 'https://images.unsplash.com/photo-1594026112284-02bb6f3352fe?auto=format&fit=crop&w=500&q=80', price: 1799, mrp: 2999, rating: 4.0, ratingCount: 421, assured: false, deliveryDate: '30 Aug' },
  { id: 'f6', name: 'Sneakers for Men Sports Running Shoes', brand: 'Sparx', category: 'Fashion', image: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?auto=format&fit=crop&w=500&q=80', price: 899, mrp: 1999, rating: 3.9, ratingCount: 3021, assured: false, deliveryDate: '28 Aug' },

  // Home
  { id: 'h1', name: 'Ceramic Coffee Mug Set of 6', brand: 'Borosil', category: 'Home', image: 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?auto=format&fit=crop&w=500&q=80', price: 599, mrp: 999, rating: 4.2, ratingCount: 782, assured: true, deliveryDate: '28 Aug' },
  { id: 'h2', name: 'LIFE FIT Diary Collection Notebook A5 Unruled 150 Pages', brand: 'LIFE FIT', category: 'Home', image: 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=500&q=80', price: 298, mrp: 795, rating: 5.0, ratingCount: 3, assured: true, deliveryDate: '28 Aug' },
  { id: 'h3', name: 'Makeup Organizer Storage Box, Acrylic', brand: 'Amazon Basics', category: 'Home', image: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=500&q=80', price: 449, mrp: 899, rating: 3.8, ratingCount: 210, assured: false, deliveryDate: '29 Aug' },

  // Grocery
  { id: 'g1', name: 'Fortune Sunflower Refined Oil, 1L', brand: 'Fortune', category: 'Grocery', image: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=500&q=80', price: 149, mrp: 189, rating: 4.4, ratingCount: 5120, assured: true, deliveryDate: 'Tomorrow' },
  { id: 'g2', name: 'Aashirvaad Select Atta, 5kg', brand: 'Aashirvaad', category: 'Grocery', image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=500&q=80', price: 259, mrp: 299, rating: 4.5, ratingCount: 8342, assured: true, deliveryDate: 'Tomorrow' },
  { id: 'g3', name: "Maggi 2-Minute Noodles, Pack of 12", brand: 'Maggi', category: 'Grocery', image: 'https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?auto=format&fit=crop&w=500&q=80', price: 144, mrp: 168, rating: 4.6, ratingCount: 15230, assured: true, deliveryDate: 'Tomorrow' },
];

export const CATEGORY_FILTERS = ['Mobiles', 'Electronics', 'Smart Gadgets', 'Appliances', 'Fashion', 'Home', 'Grocery'];

export const BRAND_FILTERS = Array.from(new Set(PRODUCT_CATALOG.map((p) => p.brand))).sort();

export const RATING_FILTERS = [
  { id: '4', label: '4★ & above', value: 4 },
  { id: '3', label: '3★ & above', value: 3 },
  { id: '2', label: '2★ & above', value: 2 },
];

export const PRICE_RANGE_FILTERS = [
  { id: 'p1', label: 'Under ₹500', min: 0, max: 500 },
  { id: 'p2', label: '₹500 - ₹2,000', min: 500, max: 2000 },
  { id: 'p3', label: '₹2,000 - ₹10,000', min: 2000, max: 10000 },
  { id: 'p4', label: 'Above ₹10,000', min: 10000, max: Infinity },
];

export const SORT_OPTIONS = [
  { id: 'relevance', label: 'Relevance' },
  { id: 'popularity', label: 'Popularity' },
  { id: 'price_low', label: 'Price -- Low to High' },
  { id: 'price_high', label: 'Price -- High to Low' },
  { id: 'discount', label: 'Discount' },
  { id: 'rating', label: 'Rating' },
];

export const TRENDING_SEARCHES = [
  'Amul Taaza Milk',
  'Farm Fresh Eggs',
  'Maggi Noodles',
  "Lay's Chips",
  'Aashirvaad Atta',
  'Coca-Cola',
  'Fresh Tomatoes',
  'Fortune Oil',
];

export const SEARCH_SUGGESTIONS = [
  { id: 'sg1', text: 'shoe rack', category: 'Shoe Rack', type: 'arrow', image: 'https://images.unsplash.com/photo-1594026112284-02bb6f3352fe?auto=format&fit=crop&w=200&q=80' },
  { id: 'sg2', text: 'shirt for men', category: 'Casual Shirts', type: 'arrow', image: 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&w=200&q=80' },
  { id: 'sg3', text: 'shoes for men', type: 'arrow', image: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?auto=format&fit=crop&w=200&q=80' },
  { id: 'sg4', text: 'shoe rack wooden', type: 'arrow', image: 'https://images.unsplash.com/photo-1594620302200-9a762244a156?auto=format&fit=crop&w=200&q=80' },
  { id: 'sg5', text: 'shoes for girls', type: 'arrow', image: 'https://images.unsplash.com/photo-1595341888016-a392ef81b7de?auto=format&fit=crop&w=200&q=80' },
  { id: 'sg6', text: 'short kurti', type: 'arrow', image: 'https://images.unsplash.com/photo-1583744946564-b52ac1c389c8?auto=format&fit=crop&w=200&q=80' },
  { id: 'sg7', text: 'shoe organizer', type: 'arrow', image: 'https://images.unsplash.com/photo-1607346256330-dee7af15f7c5?auto=format&fit=crop&w=200&q=80' },
  { id: 'sg8', text: 'shoe rack plastic', type: 'arrow', image: 'https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd?auto=format&fit=crop&w=200&q=80' },
  { id: 'sg9', text: 'Samsung', category: 'Brand Store', type: 'chevron', image: 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&w=200&q=80' },
  { id: 'sg10', text: 'Earbuds', category: 'Top Sale Discounts', type: 'chevron', image: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=200&q=80' },
];

export const ASK_AI_SUGGESTIONS = ['Best budget smartphone under 15000', 'Wireless earbuds with long battery life'];

export const RECENT_SEARCHES_SEED = ['boAt earbuds', 'running shoes', 'kitchen appliances'];
