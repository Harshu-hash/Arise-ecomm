import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  FlatList,
  TouchableOpacity,
  Share,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useAnimatedReaction,
  interpolate,
  withTiming,
  withSpring,
  Easing,
  Extrapolation,
  runOnJS,
} from 'react-native-reanimated';
import { COLORS } from '../../../constants/colors';
import { SPACING, RADIUS } from '../../../constants/spacing';
import { StatusBarManager, BottomSheetModal } from '../../../shared/components';
import PressableScale from '../../../shared/ui/PressableScale';
import { haptics } from '../../../utils/haptics';
import { useToast } from '../../../contexts/ToastContext';

// Aliases onto the app theme (Flipkart-derived palette in constants/colors).
const PINK = COLORS.primary;
const PINK_BG = COLORS.primaryLight;
const ORANGE = COLORS.ratingGreen;
const GREEN = COLORS.ratingGreen;
const MEGA_BG = COLORS.primaryLight;

const IMG = (id, w = 600) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;
const FALLBACK_IMAGES = [
  IMG('photo-1596755094514-f87e34085b2c'),
  IMG('photo-1602810318383-e386cc2a3ccf'),
  IMG('photo-1603252109303-2751441dd157'),
  IMG('photo-1620012253295-c15cc3e65df4'),
];

const DEFAULT_PRODUCT = {
  id: 'p-46351675',
  brand: 'Beyoung',
  name: 'Men Casual Shirt',
  price: 915,
  mrp: 2499,
  rating: 3.9,
  ratingCount: 135,
  reviewCount: 26,
  color: 'Maroon',
  sizes: ['38', '40', '42', '44', '46'],
  image: FALLBACK_IMAGES[0],
  images: FALLBACK_IMAGES,
  deliveryDate: 'Tue, 6 Oct',
  address: 'Block - 3rd floor, Corporate House, 307 B,...',
  description:
    'Maroon Textured Opaque Casual shirts, has a Spread Collar, Button Placket, 2 Flap pocket, Long Regular Sleeves, Curved hem',
  fit: 'Regular Fit',
  modelInfo: "The model (height 6') is wearing a size 40",
  care: 'Gentle Machine Wash',
  productCode: '46351675',
  manufacturer:
    'Beyoung Folks Pvt. Ltd.Eklingpura Chouraha, Ahmedabad Main Road (NH 8- Near Mahadev Hotel) Udaipur, India- 313002',
  countryOfOrigin: 'India',
};

const COLOUR_OPTIONS = [
  { name: 'Maroon', image: FALLBACK_IMAGES[0] },
  { name: 'Blue', image: FALLBACK_IMAGES[1] },
  { name: 'Black', image: FALLBACK_IMAGES[2] },
  { name: 'Grey', image: FALLBACK_IMAGES[3] },
];

const SIMILAR_PRODUCTS = [
  {
    id: 'sim1',
    brand: 'Kuons',
    name: 'Dark Indigo Denim Shacket',
    image: IMG('photo-1576995853123-5a10305d93c0', 400),
    price: 1995,
    mrp: 3999,
    discountPct: 50,
    ad: true,
  },
  {
    id: 'sim2',
    brand: 'Beyoung',
    name: 'Corduroy Shirt for Men',
    image: IMG('photo-1602810318383-e386cc2a3ccf', 400),
    price: 915,
    mrp: 2499,
    discountPct: 63,
  },
  {
    id: 'sim3',
    brand: 'Beyoung',
    name: 'Corduroy Shirt for Men',
    image: IMG('photo-1596755094514-f87e34085b2c', 400),
    price: 915,
    mrp: 2499,
    discountPct: 63,
  },
];

const REVIEWS = [
  {
    id: 'r1',
    stars: 4,
    date: 'May 29, 2026',
    size: '42',
    text: 'What I liked the most is the perfect balance between softness and durability. The fabric feels premium and the fit is true to size.',
    author: 'Kuldeep Chakraverti',
  },
  {
    id: 'r2',
    stars: 5,
    date: 'May 28, 2026',
    size: '40',
    text: 'Very comfortable. The fit is perfect and the quality is good for the price.',
    author: 'Myntra Customer',
  },
];

const SUGGESTIONS = [
  {
    id: 's1',
    brand: 'Beyoung',
    name: 'Men Corduroy Shirts',
    image: IMG('photo-1603252109303-2751441dd157', 400),
    price: 822,
    mrp: 2499,
    discountPct: 67,
    rating: 3.9,
  },
  {
    id: 's2',
    brand: 'Basics',
    name: 'Casual Shirt',
    image: IMG('photo-1620012253295-c15cc3e65df4', 400),
    price: 2499,
  },
  {
    id: 's3',
    brand: 'Roadster',
    name: 'Men Slim Fit Shirt',
    image: IMG('photo-1589310243389-96a5483213a8', 400),
    price: 749,
    mrp: 1799,
    discountPct: 58,
    rating: 4.1,
  },
  {
    id: 's4',
    brand: 'HRX',
    name: 'Men Casual Shirt',
    image: IMG('photo-1598033129183-c4f50c736f10', 400),
    price: 899,
    mrp: 1999,
    discountPct: 55,
    rating: 4.3,
  },
];

const SIZE_CHART_ROWS = [
  { size: '38', chest: '38', length: '28.5', shoulder: '16.5' },
  { size: '40', chest: '40', length: '29', shoulder: '17' },
  { size: '42', chest: '42', length: '29.5', shoulder: '17.5' },
  { size: '44', chest: '44', length: '30', shoulder: '18' },
  { size: '46', chest: '46', length: '30.5', shoulder: '18.5' },
];

const BANK_OFFERS = [
  { id: 'o1', icon: 'credit-card', title: '10% off up to ₹150', text: 'On HDFC Bank Credit Card EMI transactions, min spend ₹5,000' },
  { id: 'o2', icon: 'tag', title: 'Get extra 5% off', text: 'Apply coupon EXTRA5 at checkout, valid on this product' },
  { id: 'o3', icon: 'repeat', title: 'No Cost EMI', text: 'Available on orders above ₹3,000. EMI starts at ₹305/month' },
];

const CTA_HEIGHT = 46;
const CTA_FADE = 24;
const SUGGESTION_TABS = ['All', 'Similar', 'Your Next Favourites'];
const formatINR = n => `₹${Number(n).toLocaleString('en-IN')}`;

const Section = ({ title, right, children, style }) => (
  <View style={[styles.section, style]}>
    {title ? (
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {right}
      </View>
    ) : null}
    {children}
  </View>
);

// Collapsible section: the body is always mounted (measured off-flow) and its height/opacity are
// animated on the UI thread, so opening and closing stay smooth.
const Dropdown = ({ title, children, style }) => {
  const progress = useSharedValue(0);
  const bodyH = useSharedValue(0);

  const toggle = () => {
    progress.value = withTiming(progress.value > 0.5 ? 0 : 1, {
      duration: 300,
      easing: Easing.out(Easing.cubic),
    });
  };

  const bodyStyle = useAnimatedStyle(() => ({
    height: bodyH.value * progress.value,
    opacity: progress.value,
  }));
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: progress.value * 180 + 'deg' }],
  }));

  return (
    <View style={[styles.dropdown, style]}>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={toggle}
        hitSlop={{ top: 6, bottom: 6 }}
        style={styles.dropdownHeader}
      >
        <Text style={styles.sectionTitle}>{title}</Text>
        <Animated.View style={chevronStyle}>
          <Icon name="chevron-down" size={20} color={COLORS.textPrimary} />
        </Animated.View>
      </TouchableOpacity>
      <Animated.View style={[styles.dropdownClip, bodyStyle]}>
        <View
          style={styles.dropdownBody}
          onLayout={e => {
            bodyH.value = e.nativeEvent.layout.height;
          }}
        >
          {children}
        </View>
      </Animated.View>
    </View>
  );
};

const InfoBlock = ({ title, children }) => (
  <View style={styles.infoBlock}>
    <Text style={styles.infoTitle}>{title}</Text>
    <Text style={styles.infoText}>{children}</Text>
  </View>
);

const ProductDetailScreen = ({ route, navigation }) => {
  const insets = useSafeAreaInsets();
  const { width, height: windowHeight } = useWindowDimensions();
  const product = useMemo(
    () => ({ ...DEFAULT_PRODUCT, ...(route?.params?.product || {}) }),
    [route?.params?.product],
  );

  const gallery = product.images?.length ? product.images : [product.image].filter(Boolean);
  const [activeImage, setActiveImage] = useState(0);
  const [selectedColor, setSelectedColor] = useState(product.color);
  const [selectedSize, setSelectedSize] = useState(null);
  const [sizeError, setSizeError] = useState(false);
  const [wishlisted, setWishlisted] = useState(false);
  const heartScale = useSharedValue(1);
  const [suggestionTab, setSuggestionTab] = useState('All');
  const [addedToBag, setAddedToBag] = useState(false);
  const [priceAlertOn, setPriceAlertOn] = useState(false);
  const [sizeChartVisible, setSizeChartVisible] = useState(false);
  const [offersVisible, setOffersVisible] = useState(false);
  const [likedSuggestions, setLikedSuggestions] = useState(() => new Set());
  const toast = useToast();
  // One CTA pair: pinned to the bottom until the in-page slot under the size chart reaches it,
  // then it travels with the page. Position is derived from scroll on the UI thread (no re-renders).
  const scrollY = useSharedValue(0);
  const viewH = useSharedValue(windowHeight);
  const slotTop = useSharedValue(1e6);
  const pinOffset = Math.max(insets.bottom, 10);

  const onScroll = useAnimatedScrollHandler(e => {
    scrollY.value = e.contentOffset.y;
  });

  const ctaStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: Math.min(viewH.value - CTA_HEIGHT - pinOffset, slotTop.value - scrollY.value) },
    ],
  }));

  // Fade the bar's backdrop (white + top border) out as the buttons settle into the page.
  const backdropStyle = useAnimatedStyle(() => {
    const gap = slotTop.value - scrollY.value - (viewH.value - CTA_HEIGHT - pinOffset);
    return { opacity: interpolate(gap, [-CTA_FADE, 0], [0, 1], Extrapolation.CLAMP) };
  });

  useAnimatedReaction(
    () => slotTop.value - scrollY.value >= viewH.value - CTA_HEIGHT - pinOffset,
    (pinned, prev) => {
      if (prev !== null && pinned !== prev) {
        // pinned:true→false is the bar detaching from its bottom-pinned spot;
        // true is it re-sticking there.
        runOnJS(haptics[pinned ? 'medium' : 'selection'])();
      }
    },
  );

  const discountPct =
    product.discountPct ||
    (product.mrp > product.price
      ? Math.round(((product.mrp - product.price) / product.mrp) * 100)
      : 0);
  const megaPrice = Math.round(product.price * 0.704);
  const extraOff = product.price - megaPrice;

  const colours = COLOUR_OPTIONS.some(c => c.name === product.color)
    ? COLOUR_OPTIONS
    : [{ name: product.color, image: gallery[0] }, ...COLOUR_OPTIONS];

  const requireSize = () => {
    if (!selectedSize) {
      setSizeError(true);
      return false;
    }
    setSizeError(false);
    return true;
  };

  const onAddToBag = () => {
    if (!requireSize()) return;
    if (addedToBag) {
      haptics.light();
      navigation && navigation.navigate('Cart');
      return;
    }
    haptics.medium();
    setAddedToBag(true);
  };

  const onBuyNow = () => {
    if (!requireSize()) return;
    haptics.medium();
    navigation &&
      navigation.navigate('Checkout', {
        items: [
          {
            id: product.id,
            name: `${product.brand} ${product.name}`,
            variant: `${selectedColor}, Size ${selectedSize}`,
            qty: 1,
            price: product.price,
            mrp: product.mrp,
            image: product.image || gallery[0],
          },
        ],
      });
  };

  const onShare = () => {
    Share.share({
      message: `${product.brand} ${product.name} - ${formatINR(product.price)}`,
    }).catch(() => {});
  };

  const openProduct = p => navigation && navigation.push('ProductDetail', { product: p });

  const toggleWishlist = () => {
    setWishlisted(w => {
      const next = !w;
      haptics[next ? 'medium' : 'light']();
      heartScale.value = withSpring(1.3, { damping: 9, stiffness: 180 }, () => {
        heartScale.value = withSpring(1, { damping: 12, stiffness: 200 });
      });
      return next;
    });
  };

  const heartAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
  }));

  const togglePriceAlert = () => {
    setPriceAlertOn((on) => {
      const next = !on;
      haptics.selection();
      toast.show(
        next ? "We'll notify you when the price drops" : 'Price alert removed',
        { icon: next ? 'bell' : 'bell-off' },
      );
      return next;
    });
  };

  const openSizeChart = () => {
    haptics.selection();
    setSizeChartVisible(true);
  };

  const openOffers = () => {
    haptics.selection();
    setOffersVisible(true);
  };

  const handleAddressChange = () => {
    haptics.selection();
    navigation && navigation.navigate('SavedAddresses');
  };

  const handleViewReviews = () => {
    haptics.selection();
    navigation && navigation.navigate('Reviews');
  };

  const handleSimilarAdd = (item) => {
    haptics.medium();
    toast.show(`${item.brand} ${item.name} added to bag`, { icon: 'check', variant: 'success' });
  };

  const toggleSuggestionLike = (id) => {
    haptics.light();
    setLikedSuggestions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const visibleSuggestions =
    suggestionTab === 'Similar'
      ? SUGGESTIONS.filter(s => s.discountPct)
      : suggestionTab === 'Your Next Favourites'
        ? [...SUGGESTIONS].reverse()
        : SUGGESTIONS;

  const ctaButtons = (
    <>
      <PressableScale
        haptic={false}
        onPress={onAddToBag}
        style={[styles.ctaBtn, styles.addBagBtn]}
      >
        <Icon name="shopping-bag" size={17} color={COLORS.textPrimary} />
        <Text style={styles.addBagText}>{addedToBag ? 'Go to Bag' : 'Add to Bag'}</Text>
      </PressableScale>
      <PressableScale
        haptic={false}
        onPress={onBuyNow}
        style={[styles.ctaBtn, styles.buyNowBtn]}
      >
        <Icon name="zap" size={17} color={COLORS.textPrimary} />
        <Text style={styles.buyNowText}>Buy Now</Text>
      </PressableScale>
    </>
  );

  return (
    <View style={styles.container}>
      <StatusBarManager barStyle="dark-content" themeColor={COLORS.surface} />

      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity
          onPress={() => navigation && navigation.goBack()}
          style={styles.headerBtn}
        >
          <Icon name="arrow-left" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerRight}>
          <TouchableOpacity
            onPress={() => navigation && navigation.navigate('Search')}
            style={styles.headerBtn}
          >
            <Icon name="search" size={21} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation && navigation.navigate('Cart')}
            style={styles.headerBtn}
          >
            <Icon name="shopping-bag" size={21} color={COLORS.textPrimary} />
            {addedToBag ? <View style={styles.bagDot} /> : null}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.flex}>
        <Animated.ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 110 }}
          scrollEventThrottle={16}
          onScroll={onScroll}
          onLayout={e => {
            viewH.value = e.nativeEvent.layout.height;
          }}
        >
          {/* Image gallery */}
          <View>
            <FlatList
              data={gallery}
              horizontal
              pagingEnabled
              keyExtractor={(uri, i) => `${uri}-${i}`}
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={e =>
                setActiveImage(Math.round(e.nativeEvent.contentOffset.x / width))
              }
              renderItem={({ item }) => (
                <Image
                  source={{ uri: item }}
                  style={{ width, height: width * 1.2, backgroundColor: COLORS.mutedBg }}
                  resizeMode="cover"
                />
              )}
            />
            <View style={styles.ratingPill}>
              <Text style={styles.ratingPillText}>{product.rating}</Text>
              <Icon name="star" size={11} color={GREEN} />
              <View style={styles.ratingDivider} />
              <Text style={styles.ratingPillCount}>{product.ratingCount}</Text>
            </View>
            <View style={styles.dots}>
              {gallery.map((_, i) => (
                <View key={i} style={[styles.dot, i === activeImage && styles.dotActive]} />
              ))}
            </View>
          </View>

          {/* Action pills */}
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.actionPill} activeOpacity={0.7} onPress={togglePriceAlert}>
              <Icon name={priceAlertOn ? 'bell' : 'bell-off'} size={22} color={priceAlertOn ? PINK : COLORS.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionPill}
              activeOpacity={0.7}
              onPress={toggleWishlist}
            >
              <Animated.View style={heartAnimatedStyle}>
                <Icon name="heart" size={22} color={wishlisted ? PINK : COLORS.textPrimary} />
              </Animated.View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionPill} activeOpacity={0.7} onPress={onShare}>
              <Icon name="share-2" size={22} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Title & price */}
          <View style={styles.padded}>
            <Text style={styles.title}>
              <Text style={styles.titleBrand}>{product.brand} </Text>
              {product.name}
            </Text>
            <View style={styles.priceRow}>
              {product.mrp > product.price ? (
                <Text style={styles.mrp}>
                  MRP <Text style={styles.mrpStrike}>{formatINR(product.mrp)}</Text>
                </Text>
              ) : null}
              <Text style={styles.price}>{formatINR(product.price)}</Text>
              {discountPct > 0 ? (
                <View style={styles.discountBadge}>
                  <Text style={styles.discountBadgeText}>{discountPct}% OFF!</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.salePrice}>Sale Price Live</Text>
          </View>

          {/* Mega deal */}
          <View style={[styles.megaCard, styles.padded2]}>
            <View style={styles.megaTop}>
              <View style={styles.megaLogo}>
                <Text style={styles.megaLogoText}>MEGA{'\n'}DEAL</Text>
              </View>
              <View style={styles.megaPriceWrap}>
                <Text style={styles.megaPrice}>Get at {formatINR(megaPrice)}</Text>
                <View style={styles.megaUnderline} />
              </View>
              <View style={styles.extraOff}>
                <Text style={styles.extraOffText}>Extra {formatINR(extraOff)} Off</Text>
              </View>
            </View>
            <TouchableOpacity activeOpacity={0.8} style={styles.megaBottom} onPress={openOffers}>
              <Text style={styles.megaBottomText}>
                With Coupon + <Icon name="credit-card" size={14} color={COLORS.offerRed} /> Bank
                Offer
              </Text>
              <Text style={styles.detailsLink}>Details ›</Text>
            </TouchableOpacity>
          </View>

          {/* Colour */}
          <View style={[styles.padded, { marginTop: SPACING.xl }]}>
            <Text style={styles.label}>
              <Text style={styles.labelBold}>Colour </Text>
              {selectedColor}
            </Text>
          </View>
          <FlatList
            data={colours}
            horizontal
            keyExtractor={c => c.name}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.colourList}
            renderItem={({ item }) => (
              <TouchableOpacity activeOpacity={0.8} onPress={() => setSelectedColor(item.name)}>
                <Image
                  source={{ uri: item.image }}
                  style={[
                    styles.colourThumb,
                    item.name === selectedColor && styles.colourThumbActive,
                  ]}
                />
              </TouchableOpacity>
            )}
          />

          {/* Size */}
          <View style={[styles.padded, styles.sizeHeader]}>
            <Text style={styles.sizeTitle}>Select Size</Text>
            <TouchableOpacity onPress={openSizeChart}>
              <Text style={styles.sizeChart}>Size Chart ›</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.sizeRow}>
            {product.sizes.map(s => (
              <TouchableOpacity
                key={s}
                activeOpacity={0.8}
                onPress={() => {
                  setSelectedSize(s);
                  setSizeError(false);
                }}
                style={[
                  styles.sizeBox,
                  selectedSize === s && styles.sizeBoxActive,
                  sizeError && styles.sizeBoxError,
                ]}
              >
                <Text style={[styles.sizeText, selectedSize === s && styles.sizeTextActive]}>
                  {s}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {sizeError ? (
            <Text style={[styles.padded, styles.sizeErrorText]}>Please select a size</Text>
          ) : null}

          {/* Invisible placeholder reserving the in-page spot; the real buttons are the overlay below */}
          <View
            style={[styles.ctaRow, styles.padded, styles.ctaHidden]}
            pointerEvents="none"
            onLayout={e => {
              slotTop.value = e.nativeEvent.layout.y;
            }}
          />

          {/* Delivery & Services */}
          <Section title="Delivery & Services" style={styles.padded}>
            <TouchableOpacity activeOpacity={0.8} style={styles.addressBox} onPress={handleAddressChange}>
              <Icon name="map-pin" size={20} color={COLORS.textPrimary} />
              <Text style={styles.addressText} numberOfLines={1}>
                <Text style={styles.addressBold}>{product.address.split(' - ')[0]} - </Text>
                {product.address.split(' - ').slice(1).join(' - ')}
              </Text>
              <Text style={styles.changeText}>Change</Text>
            </TouchableOpacity>

            <View style={styles.deliveryCard}>
              <View style={styles.radioOn}>
                <Icon name="check" size={14} color={COLORS.white} />
              </View>
              <View style={{ flex: 1, marginLeft: SPACING.m }}>
                <View style={styles.rowCenter}>
                  <Icon name="package" size={16} color={COLORS.textSecondary} />
                  <Text style={styles.standardText}>STANDARD</Text>
                </View>
                <Text style={styles.deliveryBy}>Delivery by {product.deliveryDate}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.deliveryMrp}>MRP {formatINR(product.mrp)}</Text>
                <Text style={styles.deliveryPrice}>
                  {formatINR(product.price)}{' '}
                  <Text style={styles.deliveryOff}>({discountPct}% OFF)</Text>
                </Text>
              </View>
            </View>

            <View style={styles.serviceRow}>
              <View style={styles.serviceIcon}>
                <Icon name="credit-card" size={26} color={COLORS.textPrimary} />
                <View style={styles.serviceTick}>
                  <Icon name="check" size={10} color={GREEN} />
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.serviceTitle}>Pay on Delivery is available</Text>
                <Text style={styles.serviceSub}>
                  Additional Cash/Pay On Delivery fee applicable
                </Text>
              </View>
            </View>
            <View style={styles.serviceRow}>
              <View style={styles.serviceIcon}>
                <Icon name="repeat" size={26} color={COLORS.textPrimary} />
                <View style={styles.serviceTick}>
                  <Icon name="check" size={10} color={GREEN} />
                </View>
              </View>
              <Text style={[styles.serviceTitle, { flex: 1 }]}>
                Hassle free 7 days Return & Exchange
              </Text>
            </View>
          </Section>

          {/* Product details card */}
          <View style={[styles.detailsCard, styles.padded2]}>
            <InfoBlock title="Product Details">{product.description}</InfoBlock>
            <InfoBlock title="Size & Fit">{`Brand Fit:\n Fit: ${product.fit}\n ${product.modelInfo}`}</InfoBlock>
            <InfoBlock title="Material & Care">{product.care}</InfoBlock>
          </View>

          {/* Trust badges */}
          <View style={styles.badgeRow}>
            <View style={styles.badgeItem}>
              <View style={[styles.badgeCircle, { backgroundColor: COLORS.ratingGreenBg }]}>
                <Icon name="shield" size={28} color={COLORS.primary} />
              </View>
              <Text style={styles.badgeLabel}>Genuine{'\n'}Product</Text>
            </View>
            <View style={styles.badgeItem}>
              <View style={[styles.badgeCircle, { backgroundColor: COLORS.ratingGreenBg }]}>
                <Icon name="check-circle" size={28} color={PINK} />
              </View>
              <Text style={styles.badgeLabel}>Quality{'\n'}Checked</Text>
            </View>
          </View>

          <View style={styles.padded}>
            <Text style={styles.easyTitle}>Easy 7 days returns and exchanges</Text>
            <Text style={styles.easySub}>
              Choose to return or exchange for a different size (if available) within 7 days.
            </Text>
          </View>

          {/* Similar products */}
          <Section title="Similar Products" style={[styles.padded, { marginTop: SPACING.xxl }]}>
            <FlatList
              data={SIMILAR_PRODUCTS}
              horizontal
              keyExtractor={p => p.id}
              showsHorizontalScrollIndicator={false}
              renderItem={({ item }) => (
                <View style={styles.simCard}>
                  <TouchableOpacity activeOpacity={0.85} onPress={() => openProduct(item)}>
                    <View style={styles.simImageBox}>
                      <Image
                        source={{ uri: item.image }}
                        style={styles.simImage}
                        resizeMode="cover"
                      />
                      {item.ad ? <Text style={styles.adTag}>AD</Text> : null}
                    </View>
                    <Text style={styles.simBrand}>{item.brand}</Text>
                    <Text style={styles.simName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.simPriceRow}>
                      <Text style={styles.simMrp}>{formatINR(item.mrp)} </Text>
                      <Text style={styles.simPrice}>{formatINR(item.price)} </Text>
                      <Text style={styles.simOff}>{item.discountPct}% OFF</Text>
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => handleSimilarAdd(item)}
                    style={styles.simAddBtn}
                  >
                    <Text style={styles.simAddText}>Add to Bag</Text>
                  </TouchableOpacity>
                </View>
              )}
            />
          </Section>

          {/* Ratings & Reviews */}
          <Section title="Ratings & Reviews" style={[styles.padded, { marginTop: SPACING.xxl }]}>
            <View style={styles.rowCenter}>
              <View style={styles.ratingGreenBadge}>
                <Text style={styles.ratingGreenText}>{product.rating}</Text>
                <Icon name="star" size={16} color={COLORS.white} />
              </View>
              <TouchableOpacity style={styles.ratingCountPill} onPress={handleViewReviews}>
                <Text style={styles.ratingCountText}>{product.ratingCount} ratings</Text>
                <View style={styles.ratingCountDivider} />
                <Text style={styles.ratingCountText}>{product.reviewCount} reviews ›</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={gallery}
              horizontal
              keyExtractor={(u, i) => `rv-${i}`}
              showsHorizontalScrollIndicator={false}
              style={{ marginTop: SPACING.l }}
              renderItem={({ item }) => <Image source={{ uri: item }} style={styles.reviewPhoto} />}
            />
          </Section>

          <Section
            title={`Customer Reviews (${product.reviewCount})`}
            style={[styles.padded, { marginTop: SPACING.xxl }]}
            right={
              <TouchableOpacity onPress={handleViewReviews}>
                <Text style={styles.viewAll}>View All</Text>
              </TouchableOpacity>
            }
          >
            <FlatList
              data={REVIEWS}
              horizontal
              keyExtractor={r => r.id}
              showsHorizontalScrollIndicator={false}
              renderItem={({ item }) => (
                <View style={[styles.reviewCard, { width: width * 0.72 }]}>
                  <View style={styles.reviewTop}>
                    <View style={styles.reviewStars}>
                      <Text style={styles.reviewStarsText}>{item.stars}</Text>
                      <Icon name="star" size={12} color={COLORS.white} />
                    </View>
                    <Text style={styles.reviewDate}>{item.date}</Text>
                    <View style={styles.reviewSize}>
                      <Text style={styles.reviewSizeText}>Size: {item.size}</Text>
                    </View>
                  </View>
                  <Text style={styles.reviewBody} numberOfLines={3}>
                    {item.text}
                    <Text style={styles.readMore} onPress={handleViewReviews}> read more</Text>
                  </Text>
                  <View style={styles.reviewAuthorRow}>
                    <Icon name="check-circle" size={16} color={GREEN} />
                    <Text style={styles.reviewAuthor}>{item.author}</Text>
                  </View>
                </View>
              )}
            />
          </Section>

          {/* More information */}
          <Dropdown title="More Information" style={{ marginTop: SPACING.xxl }}>
            <Text style={styles.infoText}>Product Code: {product.productCode}</Text>
            <InfoBlock title="Manufacturer Detail">{product.manufacturer}</InfoBlock>
            <InfoBlock title="Packer Detail">{product.manufacturer}</InfoBlock>
            <InfoBlock title="Country of Origin">{product.countryOfOrigin}</InfoBlock>
          </Dropdown>

          {/* Products you may like */}
          <Section
            title="Products you may like"
            style={[styles.padded, { marginTop: SPACING.xxl }]}
          >
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: SPACING.l }}
            >
              {SUGGESTION_TABS.map(t => (
                <TouchableOpacity
                  key={t}
                  activeOpacity={0.8}
                  onPress={() => setSuggestionTab(t)}
                  style={[styles.tabPill, suggestionTab === t && styles.tabPillActive]}
                >
                  <Text style={[styles.tabText, suggestionTab === t && styles.tabTextActive]}>
                    {t}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={styles.grid}>
              {visibleSuggestions.map(item => (
                <TouchableOpacity
                  key={item.id}
                  activeOpacity={0.85}
                  onPress={() => openProduct(item)}
                  style={styles.gridCard}
                >
                  <View style={styles.gridImageBox}>
                    <Image
                      source={{ uri: item.image }}
                      style={styles.gridImage}
                      resizeMode="cover"
                    />
                    {item.rating ? (
                      <View style={styles.gridRating}>
                        <Text style={styles.gridRatingText}>{item.rating}</Text>
                        <Icon name="star" size={11} color={GREEN} />
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.gridMeta}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.gridBrand}>{item.brand}</Text>
                      <Text style={styles.gridName} numberOfLines={1}>
                        {item.name}
                      </Text>
                    </View>
                    <TouchableOpacity
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      onPress={() => toggleSuggestionLike(item.id)}
                    >
                      <Icon
                        name="heart"
                        size={22}
                        color={likedSuggestions.has(item.id) ? PINK : COLORS.textPrimary}
                      />
                    </TouchableOpacity>
                  </View>
                  <Text>
                    {item.mrp ? <Text style={styles.simMrp}>{formatINR(item.mrp)} </Text> : null}
                    <Text style={styles.gridPrice}>{formatINR(item.price)} </Text>
                    {item.discountPct ? (
                      <Text style={styles.simOff}>{item.discountPct}% OFF</Text>
                    ) : null}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Section>
        </Animated.ScrollView>

        {/* The single CTA pair: rides the bottom edge until it meets the in-page slot, then scrolls with the page */}
        <Animated.View style={[styles.ctaOverlay, ctaStyle]} pointerEvents="box-none">
          <Animated.View
            style={[
              styles.ctaBackdrop,
              { height: CTA_HEIGHT + SPACING.s + pinOffset },
              backdropStyle,
            ]}
            pointerEvents="none"
          />
          <View style={[styles.ctaRowFixed, styles.padded]}>{ctaButtons}</View>
        </Animated.View>
      </View>

      <BottomSheetModal visible={sizeChartVisible} onClose={() => setSizeChartVisible(false)}>
        <View style={styles.sheetContent}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Size Chart</Text>
          <Text style={styles.sheetSubtitle}>All measurements are in inches</Text>

          <View style={styles.chartTable}>
            <View style={[styles.chartRow, styles.chartHeaderRow]}>
              <Text style={[styles.chartCell, styles.chartHeaderCell]}>Size</Text>
              <Text style={[styles.chartCell, styles.chartHeaderCell]}>Chest</Text>
              <Text style={[styles.chartCell, styles.chartHeaderCell]}>Length</Text>
              <Text style={[styles.chartCell, styles.chartHeaderCell]}>Shoulder</Text>
            </View>
            {SIZE_CHART_ROWS.filter((row) => product.sizes.includes(row.size)).map((row) => (
              <View
                key={row.size}
                style={[styles.chartRow, row.size === selectedSize && styles.chartRowActive]}
              >
                <Text style={styles.chartCell}>{row.size}</Text>
                <Text style={styles.chartCell}>{row.chest}"</Text>
                <Text style={styles.chartCell}>{row.length}"</Text>
                <Text style={styles.chartCell}>{row.shoulder}"</Text>
              </View>
            ))}
          </View>
        </View>
      </BottomSheetModal>

      <BottomSheetModal visible={offersVisible} onClose={() => setOffersVisible(false)}>
        <View style={styles.sheetContent}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Available Offers</Text>
          {BANK_OFFERS.map((offer) => (
            <View key={offer.id} style={styles.offerRow}>
              <View style={styles.offerIconCircle}>
                <Icon name={offer.icon} size={18} color={PINK} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.offerTitle}>{offer.title}</Text>
                <Text style={styles.offerText}>{offer.text}</Text>
              </View>
            </View>
          ))}
        </View>
      </BottomSheetModal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  rowCenter: { flexDirection: 'row', alignItems: 'center' },
  padded: { paddingHorizontal: SPACING.l },
  padded2: { marginHorizontal: SPACING.l },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 20,
    elevation: 20,
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.m,
    paddingBottom: SPACING.s,
  },
  headerRight: { flexDirection: 'row' },
  headerBtn: { padding: 8 },
  bagDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: PINK,
  },

  ratingPill: {
    position: 'absolute',
    left: SPACING.l,
    bottom: SPACING.xl + 6,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.xs,
    gap: 3,
  },
  ratingPillText: { fontSize: 11, fontWeight: '700', color: COLORS.textPrimary },
  ratingDivider: { width: 1, height: 12, backgroundColor: COLORS.border, marginHorizontal: 4 },
  ratingPillCount: { fontSize: 11, color: COLORS.textSecondary },
  dots: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(0,0,0,0.25)' },
  dotActive: { backgroundColor: COLORS.textPrimary, width: 16 },

  actionRow: {
    flexDirection: 'row',
    gap: SPACING.m,
    paddingHorizontal: SPACING.l,
    marginTop: SPACING.l,
  },
  actionPill: {
    flex: 1,
    height: 52,
    borderRadius: RADIUS.m,
    backgroundColor: COLORS.mutedBg,
    alignItems: 'center',
    justifyContent: 'center',
  },

  title: { fontSize: 15, color: COLORS.textPrimary, marginTop: SPACING.l },
  titleBrand: { fontWeight: '800' },
  priceRow: { flexDirection: 'row', alignItems: 'center', marginTop: SPACING.s, flexWrap: 'wrap' },
  mrp: { fontSize: 14, color: COLORS.textSecondary, marginRight: 2 },
  mrpStrike: { textDecorationLine: 'line-through' },
  price: { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary, marginRight: SPACING.s },
  discountBadge: {
    backgroundColor: COLORS.ratingGreen,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderTopLeftRadius: 6,
    borderBottomLeftRadius: 6,
    borderTopRightRadius: 12,
  },
  discountBadgeText: { color: COLORS.white, fontWeight: '700', fontSize: 12 },
  salePrice: { color: ORANGE, fontWeight: '600', fontSize: 13, marginTop: SPACING.s },

  megaCard: { marginTop: SPACING.l, backgroundColor: MEGA_BG, borderRadius: RADIUS.m, padding: 4 },
  megaTop: { flexDirection: 'row', alignItems: 'center', padding: SPACING.m },
  megaLogo: {
    backgroundColor: COLORS.offerRed,
    borderRadius: 24,
    paddingHorizontal: 8,
    paddingVertical: 6,
    transform: [{ rotate: '-8deg' }],
  },
  megaLogoText: {
    color: COLORS.ctaGold,
    fontWeight: '900',
    fontSize: 11.5,
    lineHeight: 14,
    textAlign: 'center',
  },
  megaPriceWrap: { marginLeft: SPACING.m, flex: 1 },
  megaPrice: { fontSize: 15, fontWeight: '800', color: COLORS.textPrimary },
  megaUnderline: { height: 2, width: 80, backgroundColor: ORANGE, borderRadius: 1, marginTop: 1 },
  extraOff: {
    backgroundColor: COLORS.ratingGreen,
    borderRadius: RADIUS.m,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  extraOffText: { color: COLORS.white, fontWeight: '800', fontSize: 13 },
  megaBottom: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.m,
    paddingHorizontal: SPACING.l,
    paddingVertical: SPACING.m,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  megaBottomText: { fontSize: 13, color: COLORS.textSecondary },
  detailsLink: { color: PINK, fontWeight: '600', fontSize: 13 },

  label: { fontSize: 15, color: COLORS.textPrimary },
  labelBold: { fontWeight: '700' },
  colourList: { paddingHorizontal: SPACING.l, paddingTop: SPACING.m, gap: SPACING.m },
  colourThumb: {
    width: 56,
    height: 72,
    borderRadius: RADIUS.m,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colourThumbActive: { borderColor: COLORS.textPrimary },

  sizeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.xxl,
  },
  sizeTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  sizeChart: { color: PINK, fontSize: 13, fontWeight: '600' },
  sizeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.m,
    paddingHorizontal: SPACING.l,
    marginTop: SPACING.l,
  },
  sizeBox: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.m,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sizeBoxActive: { borderColor: PINK, backgroundColor: PINK_BG },
  sizeBoxError: { borderColor: COLORS.error },
  sizeText: { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary },
  sizeTextActive: { color: PINK },
  sizeErrorText: { color: PINK, fontSize: 11.5, marginTop: SPACING.s },

  ctaRow: { flexDirection: 'row', gap: SPACING.m, marginTop: SPACING.xl, height: CTA_HEIGHT },
  ctaBtn: {
    flex: 1,
    height: 46,
    borderRadius: RADIUS.s,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.s,
  },
  buyNowBtn: { backgroundColor: COLORS.ctaGold },
  buyNowText: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '700' },
  addBagBtn: { borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.white },
  addBagText: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '700' },
  dropdown: {
    marginHorizontal: SPACING.l,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.m,
    overflow: 'hidden',
  },
  dropdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.l,
    paddingVertical: SPACING.l,
  },
  dropdownClip: { overflow: 'hidden' },
  dropdownBody: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: SPACING.l,
    paddingBottom: SPACING.s,
  },
  ctaHidden: { opacity: 0 },
  sheetContent: {
    padding: SPACING.l,
    paddingBottom: SPACING.xxxl,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    marginBottom: SPACING.m,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  sheetSubtitle: {
    fontSize: 12.5,
    color: COLORS.textSecondary,
    marginTop: 2,
    marginBottom: SPACING.l,
  },
  chartTable: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.m,
    overflow: 'hidden',
  },
  chartRow: {
    flexDirection: 'row',
    paddingVertical: SPACING.m,
    paddingHorizontal: SPACING.s,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  chartHeaderRow: {
    backgroundColor: COLORS.mutedBg,
  },
  chartRowActive: {
    backgroundColor: PINK_BG,
  },
  chartCell: {
    flex: 1,
    textAlign: 'center',
    fontSize: 13,
    color: COLORS.textPrimary,
  },
  chartHeaderCell: {
    fontWeight: '700',
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  offerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: SPACING.l,
    gap: SPACING.m,
  },
  offerIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: PINK_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  offerTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  offerText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
    lineHeight: 17,
  },
  flex: { flex: 1 },
  ctaOverlay: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 5, elevation: 5 },
  ctaRowFixed: { flexDirection: 'row', gap: SPACING.m, height: CTA_HEIGHT },
  ctaBackdrop: {
    position: 'absolute',
    top: -SPACING.s,
    left: 0,
    right: 0,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBorder,
  },

  section: { marginTop: SPACING.xxl },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.l,
    paddingHorizontal: 0,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },

  addressBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.m,
    paddingHorizontal: SPACING.l,
    paddingVertical: SPACING.l,
    gap: SPACING.m,
  },
  addressText: { flex: 1, fontSize: 12, color: COLORS.textSecondary },
  addressBold: { color: COLORS.textPrimary, fontWeight: '700' },
  changeText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
    textDecorationLine: 'underline',
  },

  deliveryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.l,
    backgroundColor: PINK_BG,
    borderWidth: 1.5,
    borderColor: PINK,
    borderRadius: RADIUS.m,
    padding: SPACING.l,
  },
  radioOn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: PINK,
    alignItems: 'center',
    justifyContent: 'center',
  },
  standardText: { fontSize: 11.5, color: COLORS.textSecondary, marginLeft: 6, letterSpacing: 0.3 },
  deliveryBy: { fontSize: 13, fontWeight: '500', color: COLORS.textPrimary, marginTop: 4 },
  deliveryMrp: { fontSize: 11, color: COLORS.textSecondary, textDecorationLine: 'line-through' },
  deliveryPrice: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary, marginTop: 2 },
  deliveryOff: { color: ORANGE, fontWeight: '600', fontSize: 12 },
  serviceRow: { flexDirection: 'row', alignItems: 'center', marginTop: SPACING.l, gap: SPACING.m },
  serviceIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  serviceTick: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceTitle: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary },
  serviceSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },

  detailsCard: {
    marginTop: SPACING.xxl,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.m,
    padding: SPACING.xl,
  },
  infoBlock: { marginBottom: SPACING.l },
  infoTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 2 },
  infoText: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 21 },

  badgeRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: SPACING.xxl },
  badgeItem: { alignItems: 'center' },
  badgeCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeLabel: {
    color: COLORS.primary,
    fontWeight: '600',
    fontSize: 12,
    textAlign: 'center',
    marginTop: SPACING.s,
  },
  easyTitle: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary, marginTop: SPACING.xxl },
  easySub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4, lineHeight: 20 },

  simCard: { width: 168, marginRight: SPACING.m },
  simImageBox: {
    width: '100%',
    height: 220,
    borderRadius: RADIUS.m,
    overflow: 'hidden',
    backgroundColor: COLORS.mutedBg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  simImage: { width: '100%', height: '100%' },
  adTag: {
    position: 'absolute',
    top: 8,
    right: 8,
    fontSize: 10,
    color: COLORS.textSecondary,
    backgroundColor: 'rgba(255,255,255,0.8)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  simBrand: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary, marginTop: SPACING.s },
  simName: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  simPriceRow: { marginTop: 4 },
  simMrp: { fontSize: 11.5, color: COLORS.textSecondary, textDecorationLine: 'line-through' },
  simPrice: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary },
  simOff: { fontSize: 11.5, fontWeight: '600', color: ORANGE },
  simAddBtn: {
    marginTop: SPACING.m,
    height: 44,
    borderRadius: RADIUS.m,
    borderWidth: 1.5,
    borderColor: PINK,
    alignItems: 'center',
    justifyContent: 'center',
  },
  simAddText: { color: PINK, fontWeight: '700', fontSize: 13 },

  ratingGreenBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: GREEN,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: RADIUS.s,
  },
  ratingGreenText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
  ratingCountPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.mutedBg,
    borderRadius: RADIUS.s,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginLeft: SPACING.m,
  },
  ratingCountText: { color: COLORS.textSecondary, fontSize: 12 },
  ratingCountDivider: {
    width: 1,
    height: 16,
    backgroundColor: COLORS.border,
    marginHorizontal: 10,
  },
  reviewPhoto: {
    width: 100,
    height: 100,
    borderRadius: RADIUS.m,
    marginRight: SPACING.m,
    backgroundColor: COLORS.mutedBg,
  },

  viewAll: {
    fontSize: 13,
    color: COLORS.textPrimary,
    textDecorationLine: 'underline',
    marginBottom: SPACING.l,
  },
  reviewCard: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.m,
    padding: SPACING.l,
    marginRight: SPACING.m,
    minHeight: 190,
    justifyContent: 'space-between',
  },
  reviewTop: { flexDirection: 'row', alignItems: 'center', gap: SPACING.m },
  reviewStars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: COLORS.ratingGreen,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
  },
  reviewStarsText: { color: COLORS.white, fontWeight: '700', fontSize: 12 },
  reviewDate: { flex: 1, color: COLORS.textSecondary, fontSize: 13 },
  reviewSize: {
    backgroundColor: COLORS.mutedBg,
    borderRadius: RADIUS.s,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  reviewSizeText: { fontSize: 12, fontWeight: '600', color: COLORS.textPrimary },
  reviewBody: { fontSize: 13, color: COLORS.textPrimary, lineHeight: 23, marginTop: SPACING.l },
  readMore: { fontWeight: '700' },
  reviewAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.s,
    marginTop: SPACING.l,
  },
  reviewAuthor: { fontSize: 13, color: COLORS.textSecondary },

  tabPill: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.round,
    paddingHorizontal: 22,
    paddingVertical: 10,
    marginRight: SPACING.m,
  },
  tabPillActive: { borderColor: PINK, backgroundColor: PINK_BG },
  tabText: { fontSize: 13, fontWeight: '500', color: COLORS.textPrimary },
  tabTextActive: { color: PINK },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  gridCard: { width: '48.5%', marginBottom: SPACING.xl },
  gridImageBox: {
    width: '100%',
    aspectRatio: 0.75,
    borderRadius: RADIUS.m,
    overflow: 'hidden',
    backgroundColor: COLORS.mutedBg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  gridImage: { width: '100%', height: '100%' },
  gridRating: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: COLORS.white,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.round,
  },
  gridRatingText: { fontSize: 12, fontWeight: '600', color: COLORS.textPrimary },
  gridMeta: { flexDirection: 'row', alignItems: 'center', marginTop: SPACING.s },
  gridBrand: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary },
  gridName: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  gridPrice: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary },
});

export default ProductDetailScreen;
