import { COLORS } from '../../../constants/colors';

export const BRAND_TABS = [
  {
    id: 'flipkart',
    label: 'Arise',
    icon: 'sunrise',
    badge: 'PLUS',
    activeBg: '#FFE11B',
    activeText: '#002F6C',
    activeIcon: '#002F6C',
    badgeBg: '#002F6C',
    badgeText: '#FFE11B',
    gradient: ['#FFE11B', '#FFC200'],
  },
  {
    id: 'value365',
    label: 'Deals',
    icon: 'percent',
    iconImage: require('../../../assets/images/price-tag.png'),
    badge: '365 DEALS',
    badgeIcon: 'zap',
    activeBg: '#D32F2F',
    activeText: '#FFFFFF',
    activeIcon: '#FFD700',
    badgeBg: '#FFD700',
    badgeText: '#8B0000',
    gradient: ['#E52E2E', '#900C1F'],
  },
];

export const SEARCH_PLACEHOLDERS = [
  'Search for products, brands and more',
  'Try "wireless earbuds"',
  'Try "women\'s sneakers"',
  'Try "smart watches"',
  'Try "men\'s casual shirts"',
];

export const CATEGORY_TABS = [
  { id: 'foryou', label: 'For You', icon: 'bag-handle-outline', gradient: ['#FFCB9D', '#FFFFFF'] },
  { id: 'fashion', label: 'Fashion', icon: 'shirt-outline', gradient: ['#FFB6C1', '#FFFFFF'] },
  { id: 'mobiles', label: 'Mobiles', icon: 'phone-portrait-outline', gradient: ['#A7C7FF', '#FFFFFF'] },
  { id: 'electronics', label: 'Electronics', icon: 'laptop-outline', gradient: ['#C3B8FF', '#FFFFFF'] },
  { id: 'beauty', label: 'Beauty', icon: 'sparkles-outline', gradient: ['#FFD1E8', '#FFFFFF'] },
  { id: 'home', label: 'Home', icon: 'home-outline', gradient: ['#B8F0D1', '#FFFFFF'] },
];

export const SAVED_ADDRESSES = [
  {
    id: 'addr1',
    label: 'Home',
    icon: 'home',
    address: '84/2, Dheeraj Shah Nagar, Ratlam, Ratlam, Madhya Pradesh - 457001',
  },
  {
    id: 'addr2',
    label: 'Work',
    icon: 'briefcase',
    address: 'Shop No. 12, Station Road, Ratlam, Madhya Pradesh - 457001',
  },
  {
    id: 'addr3',
    label: 'Rahul Sharma',
    icon: 'map-pin',
    address: '221B, Vikas Nagar, Near City Mall, Ratlam, Madhya Pradesh - 457002',
  },
];

export const HERO_BANNERS = [
  { id: 'hero1', image: require('../../../assets/images/home_banner.jpeg') },
];

export const AD_BANNERS = [
  { id: 'ad1', image: require('../../../assets/images/banner1.png') },
  { id: 'ad2', image: require('../../../assets/images/banner2.png') },
  { id: 'ad3', image: require('../../../assets/images/banner3.png') },
  { id: 'ad4', image: require('../../../assets/images/banner4.png') },
];

export const RECENTLY_VIEWED = [
  { id: 'rv1', image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=300&q=80', title: 'Noise', subtitle: 'Smartwatches' },
  { id: 'rv2', image: 'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?auto=format&fit=crop&w=300&q=80', title: "Women's Night...", subtitle: 'View Store' },
  { id: 'rv3', image: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=300&q=80', title: 'Sling Bags', subtitle: 'View Store' },
  { id: 'rv4', image: 'https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?auto=format&fit=crop&w=300&q=80', title: 'Mobile Covers', subtitle: 'View Store' },
];

export const AD_TILES = [
  { id: 'at1', image: 'https://images.unsplash.com/photo-1591369822096-ffd140ec948f?auto=format&fit=crop&w=400&q=80', bannerText: 'Min. 35% Off', label: "Women's trousers" },
  { id: 'at2', image: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=400&q=80', bannerText: 'From ₹194', label: 'Makeup organizers' },
  { id: 'at3', image: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=400&q=80', bannerText: 'Up to 15% Off', label: 'Instant volume' },
];

export const SUGGESTED_PRODUCTS = [
  { id: 'sp1', name: 'Fastrack Analog Wrist Watch', image: 'https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=400&q=80', price: 118, mrp: 699 },
  { id: 'sp2', name: 'Wildcraft Travel Backpack', image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=400&q=80', price: 120, mrp: 799 },
  { id: 'sp3', name: 'Zeba Cotton Kurti', image: 'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?auto=format&fit=crop&w=400&q=80', price: 207, mrp: 999 },
  { id: 'sp4', name: 'FOXBOOM Bluetooth Speaker', image: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&w=400&q=80', price: 215, mrp: 399 },
  { id: 'sp5', name: 'XYROOO Running Shoes', image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=400&q=80', price: 144, mrp: 599 },
  { id: 'sp6', name: 'Loov Ceramic Coffee Mug Set', image: 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?auto=format&fit=crop&w=400&q=80', price: 108, mrp: 999 },
];

export const BRANDS_SPOTLIGHT = [
  { id: 'br1', name: 'boAt', image: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=400&q=80', discount: 'Up to 80% Off', subtitle: "Today's special deal" },
  { id: 'br2', name: 'Denver', image: 'https://images.unsplash.com/photo-1523293182086-7651a899d37f?auto=format&fit=crop&w=400&q=80', discount: 'Up to 50% Off', subtitle: 'Worn by the elite' },
  { id: 'br3', name: 'TVS', image: 'https://images.unsplash.com/photo-1591637333184-19aa84b3e01f?auto=format&fit=crop&w=400&q=80', discount: 'Up to 40% Off', subtitle: 'Safety first' },
];

export const TOP_VALUE_DEALS = [
  { id: 'tvd1', image: 'https://images.unsplash.com/photo-1591637333184-19aa84b3e01f?auto=format&fit=crop&w=400&q=80', label: 'Helmets', value: 'Up to 80% Off', tag: 'BESTSELLER' },
  { id: 'tvd2', image: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=400&q=80', label: 'Waist bags', value: 'Under ₹399', tag: 'TRENDING' },
  { id: 'tvd3', image: 'https://images.unsplash.com/photo-1568640347023-a616a30bc3bd?auto=format&fit=crop&w=400&q=80', label: 'Drools, Pedigree', value: 'Min. 30% Off', tag: 'SUPER SAVER' },
  { id: 'tvd4', image: 'https://images.unsplash.com/photo-1601758228041-f3b2795255f1?auto=format&fit=crop&w=400&q=80', label: 'Pet food', value: 'Min. 20% Off', tag: 'HOT DEAL' },
];

export const PRODUCT_FEED = [
  { id: 'pf1', brand: 'Shreeji', title: 'Bracelet, Jewellery Gift Set', image: 'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?auto=format&fit=crop&w=400&q=80', price: 186, mrp: 799, aspectRatio: 0.9 },
  { id: 'pf2', brand: 'Layasa', title: 'Women Slides', image: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?auto=format&fit=crop&w=400&q=80', price: 340, mrp: 999, aspectRatio: 0.75 },
  { id: 'pf3', brand: 'KAJARU', title: 'Pack of 2 Men Self Design Sweater', image: 'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?auto=format&fit=crop&w=400&q=80', price: 540, mrp: 1299, rating: 4, ratingCount: '66,071', badge: 'Lowest price', aspectRatio: 1.25 },
  { id: 'pf4', brand: 'SEMANGAT', title: 'Keep On Going Notebook Diary', image: 'https://images.unsplash.com/photo-1517842645767-c639042777db?auto=format&fit=crop&w=400&q=80', price: 200, mrp: 399, badge: 'New Arrival', aspectRatio: 1.15 },
  { id: 'pf5', brand: 'Vantiel', title: 'Croc-Textured Loafers', image: 'https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?auto=format&fit=crop&w=400&q=80', price: 899, mrp: 1999, badge: 'Lowest price', aspectRatio: 1.1 },
  { id: 'pf6', brand: 'Huggables', title: 'Giant Teddy Bear Soft Toy', image: 'https://images.unsplash.com/photo-1538292999061-16ca3647ab1c?auto=format&fit=crop&w=400&q=80', price: 799, mrp: 1799, aspectRatio: 1.2 },
  { id: 'pf7', brand: 'Norvex', title: 'Wireless Bluetooth Earbuds', image: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=400&q=80', price: 699, mrp: 2499, rating: 4.3, ratingCount: '12,450', aspectRatio: 1 },
  { id: 'pf8', brand: 'Cottoncraft', title: "Men's Cotton Casual Shirt", image: 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&w=400&q=80', price: 449, mrp: 1299, aspectRatio: 1.3 },
  { id: 'pf9', brand: 'Glowline', title: 'LED Desk Lamp with USB Charging', image: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=400&q=80', price: 599, mrp: 1499, badge: 'New Arrival', aspectRatio: 0.9 },
  { id: 'pf10', brand: 'Purelume', title: 'Ceramic Coffee Mug Set of 2', image: 'https://images.unsplash.com/photo-1517705008128-361805f42e86?auto=format&fit=crop&w=400&q=80', price: 349, mrp: 899, rating: 4.6, ratingCount: '3,208', aspectRatio: 1.05 },
];
