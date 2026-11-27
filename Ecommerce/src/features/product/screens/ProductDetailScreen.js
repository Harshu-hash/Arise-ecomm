import React, { useEffect, useState } from 'react';
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
import StarIcon from 'react-native-vector-icons/FontAwesome';
import BadgeIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useAnimatedReaction,
  withTiming,
  withSpring,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { optionCards } from '../utils/optionCards';
import { COLORS } from '../../../constants/colors';
import { SPACING, RADIUS } from '../../../constants/spacing';
import { StatusBarManager, BottomSheetModal } from '../../../shared/components';
import PressableScale from '../../../shared/ui/PressableScale';
import { haptics } from '../../../utils/haptics';
import { useToast } from '../../../contexts/ToastContext';
import FullScreenLoader from '../../../shared/loaders/FullScreenLoader';
import ErrorState from '../../../shared/ErrorState/ErrorState';
import { useGetProductQuery, useGetRelatedProductsQuery } from '../api/product.query';
import {
  useAddWishlistItemMutation,
  useGetWishlistQuery,
  useRemoveWishlistItemMutation,
} from '@features/wishlist';
import { useAddCartItemMutation } from '@features/cart';
import { useGetProductReviewsQuery } from '@features/reviews';
import { useGetAddressesQuery, useGetServiceabilityQuery } from '@features/address';
import { selectIsAuthenticated } from '@features/auth';
import { useSelector } from 'react-redux';
import { skipToken } from '@reduxjs/toolkit/query';

// Aliases onto the app theme.
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

const COLOUR_OPTIONS = [
  { name: 'Maroon', image: FALLBACK_IMAGES[0] },
  { name: 'Blue', image: FALLBACK_IMAGES[1] },
  { name: 'Black', image: FALLBACK_IMAGES[2] },
  { name: 'Grey', image: FALLBACK_IMAGES[3] },
];

const BANK_OFFERS = [
  {
    id: 'o1',
    icon: 'credit-card',
    title: '10% off up to ₹150',
    text: 'On HDFC Bank Credit Card EMI transactions, min spend ₹5,000',
  },
  {
    id: 'o2',
    icon: 'tag',
    title: 'Get extra 5% off',
    text: 'Apply coupon EXTRA5 at checkout, valid on this product',
  },
  {
    id: 'o3',
    icon: 'repeat',
    title: 'No Cost EMI',
    text: 'Available on orders above ₹3,000. EMI starts at ₹305/month',
  },
];

const CTA_HEIGHT = 46;
const SUGGESTION_TABS = ['All', 'Similar', 'Your Next Favourites'];
// Percent off for a card; 0 when it is not discounted.
const pctOff = item => (item.mrp > item.price ? Math.round(((item.mrp - item.price) / item.mrp) * 100) : 0);
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

// Sellers write section titles in capitals ("PRODUCT STORY", "FEATURES & BENEFITS"); give them real heading styling.
const HEADING_LINE = /^[A-Z][A-Z0-9 &,'’/-]{3,}$/;
const Description = ({ text }) => (
  <View style={styles.infoBlock}>
    <Text style={styles.infoTitle}>Product Details</Text>
    {text
      .split(/\n+/)
      .map(line => line.trim())
      .filter(Boolean)
      .map((line, i) =>
        HEADING_LINE.test(line) ? (
          <Text key={i} style={styles.descHeading}>
            {line}
          </Text>
        ) : (
          <Text key={i} style={styles.infoText}>
            {line}
          </Text>
        ),
      )}
  </View>
);

const SpecTable = ({ title, rows }) =>
  rows?.length > 0 ? (
    <View style={[styles.specCard, styles.padded2]}>
      <Text style={styles.specTitle}>{title}</Text>
      {rows.map((row, i) => (
        <View
          key={`${row.label}-${i}`}
          style={[styles.specTableRow, i === rows.length - 1 && styles.specTableRowLast]}
        >
          <Text style={styles.specTableLabel}>{row.label}</Text>
          <Text style={styles.specTableValue}>{row.value}</Text>
        </View>
      ))}
    </View>
  ) : null;

const ProductDetailContent = ({ product, navigation, route }) => {
  const insets = useSafeAreaInsets();
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const { data: addressBook } = useGetAddressesQuery(undefined, { skip: !isAuthenticated });
  const deliveryAddress =
    addressBook?.items.find(item => item.id === route?.params?.selectedAddressId) ??
    addressBook?.items.find(item => item.isDefault) ??
    addressBook?.items[0];
  // Shiprocket's transit estimate to this address (counted from today, with no seller dispatch time)
  const { data: serviceability } = useGetServiceabilityQuery(deliveryAddress?.pincode ?? skipToken);
  const etaDays = serviceability?.serviceable ? serviceability.estimatedDeliveryDays : null;
  const deliveryDate = etaDays
    ? new Date(Date.now() + etaDays * 86400000).toLocaleDateString('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      })
    : product.deliveryDate;
  const { width, height: windowHeight } = useWindowDimensions();

  // The newest few published reviews, only once the product has any.
  const { data: reviewData } = useGetProductReviewsQuery(
    { productId: product.id, limit: 5 },
    { skip: !(product.reviewCount > 0) },
  );
  const reviews = reviewData?.items ?? [];
  const distribution = reviewData?.summary?.distribution;
  const reviewPhotos = reviews.flatMap(review => review.media.map(photo => photo.thumbnailUrl));

  const [activeImage, setActiveImage] = useState(0);
  const [selectedColor, setSelectedColor] = useState(product.color);
  const [selectedSize, setSelectedSize] = useState(null);
  // The picked size/colour selects a variant, which owns its own price, stock and photos.
  // `options`: other things to pick between variants (storage, RAM/ROM, pack size...), starting on the first variant's choices.
  const options = product.options ?? [];
  const [selectedOptions, setSelectedOptions] = useState(() => ({ ...product.variants[0]?.attributes }));
  const variantMatches = v =>
    (!v.size || v.size === selectedSize) &&
    options.every(o => v.attributes?.[o.code] === selectedOptions[o.code]) &&
    (!v.color || !selectedColor || v.color === selectedColor);
  const activeVariant =
    (selectedSize || (options.length > 0 && product.sizes.length === 0)) ? product.variants.find(variantMatches) ?? null : null;
  // What goes in the cart: the picked variant, or for a product with no sizes the one that matches the colour.
  // The server picks the seller and checks stock; with no variant it takes the product's cheapest.
  const cartVariant =
    activeVariant ??
    product.variants.find(v => !v.size && (!v.color || v.color === selectedColor)) ??
    null;
  const price = activeVariant?.price ?? product.price;
  const mrp = activeVariant?.mrp ?? product.mrp;
  const campaign = activeVariant ? activeVariant.campaign : product.campaign;
  const productImages = product.images?.length ? product.images : [product.image].filter(Boolean);
  const gallery = activeVariant?.images.length ? activeVariant.images : productImages;
  useEffect(() => setActiveImage(0), [activeVariant?.id]);
  const [sizeError, setSizeError] = useState(false);
  const { data: wishlist } = useGetWishlistQuery();
  const [addWishlistItem, { isLoading: isAddingToWishlist }] = useAddWishlistItemMutation();
  const [removeWishlistItem, { isLoading: isRemovingFromWishlist }] =
    useRemoveWishlistItemMutation();
  const wishlisted = wishlist?.items.some(item => item.id === product.id) ?? false;
  const heartScale = useSharedValue(1);
  const [suggestionTab, setSuggestionTab] = useState('All');
  // Both rails come from the backend: the same shelf for "Similar", the wider category and the shopper's interests for the rest.
  const { data: related } = useGetRelatedProductsQuery(product.id);
  const similarProducts = related?.similar ?? [];
  const suggestedProducts = related?.suggested ?? [];
  const [addedToBag, setAddedToBag] = useState(false);
  const [addCartItem, { isLoading: isAddingToCart }] = useAddCartItemMutation();
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

  // The bar never moves: it is shown at the bottom edge while the in-page slot is below the screen and hidden once the
  // slot's own copy of the buttons is on screen. (Translating it from scroll events made it jitter, as it lags the native scroll.)
  const ctaStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: viewH.value - CTA_HEIGHT - pinOffset }],
    display: slotTop.value - scrollY.value >= viewH.value - CTA_HEIGHT - pinOffset ? 'flex' : 'none',
  }));

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
    (mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0);
  const megaPrice = Math.round(price * 0.704);
  const extraOff = price - megaPrice;

  const colours = [
    ...new Map(
      product.variants
        .filter(v => v.color)
        .map(v => [v.color, { name: v.color, image: v.images[0] || productImages[0] }]),
    ).values(),
  ];
  const variantLabel = [selectedColor, ...options.map(o => selectedOptions[o.code]), selectedSize && `Size ${selectedSize}`].filter(Boolean).join(', ');

  const requireSize = () => {
    if (product.sizes.length > 0 && !selectedSize) {
      setSizeError(true);
      return false;
    }
    setSizeError(false);
    if (activeVariant && activeVariant.stock <= 0) {
      toast.show('This size is out of stock.');
      return false;
    }
    return true;
  };

  const onAddToBag = async () => {
    if (!requireSize()) return;
    if (addedToBag) {
      haptics.light();
      navigation && navigation.navigate('Cart');
      return;
    }
    try {
      await addCartItem({ productId: product.id, variantId: cartVariant?.id, quantity: 1 }).unwrap();
      haptics.medium();
      setAddedToBag(true);
      toast.show('Added to cart', { icon: 'shopping-cart' });
    } catch (mutationError) {
      toast.show(mutationError.message || 'Could not add this product to cart.');
    }
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
            variant: variantLabel,
            qty: 1,
            price,
            mrp,
            image: gallery[0] || product.image,
          },
        ],
      });
  };

  const onShare = () => {
    Share.share({
      message: `${product.brand} ${product.name} - ${formatINR(price)}`,
    }).catch(() => {});
  };

  const openProduct = p => navigation && navigation.push('ProductDetail', { product: p });

  const toggleWishlist = async () => {
    if (isAddingToWishlist || isRemovingFromWishlist) return;
    const next = !wishlisted;
    haptics[next ? 'medium' : 'light']();
    heartScale.value = withSpring(1.3, { damping: 9, stiffness: 180 }, () => {
      heartScale.value = withSpring(1, { damping: 12, stiffness: 200 });
    });
    try {
      await (next ? addWishlistItem(product.id) : removeWishlistItem(product.id)).unwrap();
      toast.show(next ? 'Saved to wishlist' : 'Removed from wishlist', {
        icon: next ? 'heart' : 'heart-off',
      });
    } catch (mutationError) {
      toast.show(mutationError.message || 'Could not update your wishlist.');
    }
  };

  const heartAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
  }));

  const togglePriceAlert = () => {
    setPriceAlertOn(on => {
      const next = !on;
      haptics.selection();
      toast.show(next ? "We'll notify you when the price drops" : 'Price alert removed', {
        icon: next ? 'bell' : 'bell-off',
      });
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
    navigation && navigation.navigate('SavedAddresses', {
        selectMode: true,
        returnScreen: 'ProductDetail',
        returnParams: { productId: product.id }, // the product page needs its id back, whichever way navigation restores it
      });
  };

  const handleViewReviews = () => {
    haptics.selection();
    navigation &&
      navigation.navigate('Reviews', { productId: product.id, productName: product.name });
  };

  const handleViewQuestions = () => {
    haptics.selection();
    navigation &&
      navigation.navigate('QuestionsAnswers', { productId: product.id, productName: product.name });
  };

  const toggleSuggestionLike = id => {
    haptics.light();
    setLikedSuggestions(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const visibleSuggestions =
    suggestionTab === 'Similar'
      ? similarProducts
      : suggestionTab === 'Your Next Favourites'
        ? suggestedProducts
        : [...similarProducts, ...suggestedProducts];

  const ctaButtons = (
    <>
      <PressableScale
        disabled={isAddingToCart}
        haptic={false}
        onPress={onAddToBag}
        style={[styles.ctaBtn, styles.addBagBtn]}
      >
        <Icon name="shopping-bag" size={17} color={COLORS.textPrimary} />
        <Text style={styles.addBagText}>
          {isAddingToCart ? 'Adding...' : addedToBag ? 'Go to Bag' : 'Add to Bag'}
        </Text>
      </PressableScale>
      <PressableScale haptic={false} onPress={onBuyNow} style={[styles.ctaBtn, styles.buyNowBtn]}>
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
            {product.ratingCount > 0 ? (
              <View style={styles.ratingPill}>
                <Text style={styles.ratingPillText}>{product.rating}</Text>
                <StarIcon name="star" size={11} color={COLORS.starGold} />
                <View style={styles.ratingDivider} />
                <Text style={styles.ratingPillCount}>{product.ratingCount}</Text>
              </View>
            ) : null}
            <View style={styles.dots}>
              {gallery.map((_, i) => (
                <View key={i} style={[styles.dot, i === activeImage && styles.dotActive]} />
              ))}
            </View>
          </View>

          {/* Action pills */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.actionPill}
              activeOpacity={0.7}
              onPress={togglePriceAlert}
            >
              <Icon
                name={priceAlertOn ? 'bell' : 'bell-off'}
                size={22}
                color={priceAlertOn ? PINK : COLORS.textPrimary}
              />
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
              {mrp > price ? (
                <Text style={styles.mrp}>
                  MRP <Text style={styles.mrpStrike}>{formatINR(mrp)}</Text>
                </Text>
              ) : null}
              <Text style={styles.price}>{formatINR(price)}</Text>
              {discountPct > 0 ? (
                <View style={styles.discountBadge}>
                  <Text style={styles.discountBadgeText}>{discountPct}% OFF!</Text>
                </View>
              ) : null}
            </View>
            {campaign ? (
              <Text style={styles.salePrice}>
                Extra {campaign.extraOffPct}% off on {campaign.name} · {formatINR(price)} is your price with this offer
              </Text>
            ) : (
              <Text style={styles.salePrice}>Sale Price Live</Text>
            )}
          </View>

          {colours.length > 0 && (
          <>
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

          </>
          )}

          {options.map(option => (
            <View key={option.code}>
              <View style={[styles.padded, styles.sizeHeader]}>
                <Text style={styles.label}>
                  <Text style={styles.labelBold}>{`${option.name}: `}</Text>
                  {selectedOptions[option.code]}
                </Text>
              </View>
              <View style={styles.sizeRow}>
                {optionCards(product.variants, option, { selectedOptions, selectedColor, selectedSize, options }).map(card => {
                  const active = selectedOptions[option.code] === card.value;
                  return (
                    <TouchableOpacity
                      key={card.value}
                      activeOpacity={0.8}
                      onPress={() => setSelectedOptions(current => ({ ...current, [option.code]: card.value }))}
                      style={[styles.optionCard, active && styles.optionCardActive, !card.inStock && styles.optionCardOut]}
                    >
                      <Text style={[styles.optionCardTitle, active && styles.optionCardTitleActive]}>{card.value}</Text>
                      {card.price != null && (
                        <View style={styles.optionCardPriceBox}>
                          {card.discountPct > 0 ? (
                            <Text style={styles.optionCardMrpRow}>
                              <Text style={styles.optionCardDiscount}>{`↓${card.discountPct}% `}</Text>
                              <Text style={styles.optionCardMrp}>{card.mrp.toLocaleString('en-IN')}</Text>
                            </Text>
                          ) : null}
                          <Text style={styles.optionCardPrice}>{formatINR(card.price)}</Text>
                          {!card.inStock ? <Text style={styles.optionCardOutText}>Out of stock</Text> : null}
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}

          {product.sizes.length > 0 && (
          <>
          {/* Size */}
          <View style={[styles.padded, styles.sizeHeader]}>
            <Text style={styles.sizeTitle}>Select Size</Text>
            {product.sizeChart ? (
              <TouchableOpacity onPress={openSizeChart}>
                <Text style={styles.sizeChart}>Size Chart ›</Text>
              </TouchableOpacity>
            ) : null}
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

          </>
          )}

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

          {/* The in-page buttons; the pinned bar below stands in for them until this spot scrolls into view */}
          <View
            style={[styles.ctaRow, styles.padded]}
            onLayout={e => {
              slotTop.value = e.nativeEvent.layout.y;
            }}
          >
            {ctaButtons}
          </View>

          {/* Delivery & Services */}
          <Section title="Delivery & Services" style={styles.padded}>
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.addressBox}
              onPress={handleAddressChange}
            >
              <Icon name="map-pin" size={20} color={COLORS.textPrimary} />
              <Text style={styles.addressText} numberOfLines={1}>
                {deliveryAddress ? (
                  <>
                    <Text style={styles.addressBold}>
                      {deliveryAddress.name}, {deliveryAddress.pincode} -{' '}
                    </Text>
                    {deliveryAddress.address}
                  </>
                ) : (
                  'Select a delivery address'
                )}
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
                {deliveryDate ? (
                  <Text style={styles.deliveryBy}>Delivery by {deliveryDate}</Text>
                ) : null}
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.deliveryMrp}>MRP {formatINR(mrp)}</Text>
                <Text style={styles.deliveryPrice}>
                  {formatINR(price)}{' '}
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
            {product.description ? <Description text={product.description} /> : null}
            {product.fit || product.modelInfo ? (
              <InfoBlock title="Size & Fit">
                {[product.fit && `Fit: ${product.fit}`, product.modelInfo].filter(Boolean).join('\n')}
              </InfoBlock>
            ) : null}
            {product.care ? <InfoBlock title="Material & Care">{product.care}</InfoBlock> : null}
          </View>

          {/* Highlights: category attributes + the seller's "Label: value" lines, as a spec table. */}
          <SpecTable title="Product Highlights" rows={product.specifications} />

          {/* Trust badges */}
          <View style={styles.badgeRow}>
            <View style={styles.badgeItem}>
              <View style={[styles.badgeCircle, { backgroundColor: COLORS.ratingGreenBg }]}>
                <BadgeIcon name="shield-star" size={34} color={COLORS.primary} />
              </View>
              <Text style={styles.badgeLabel}>Genuine{'\n'}Product</Text>
            </View>
            <View style={styles.badgeItem}>
              <View style={[styles.badgeCircle, { backgroundColor: COLORS.ratingGreenBg }]}>
                <BadgeIcon name="check-decagram" size={34} color={COLORS.ratingGreen} />
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
          {similarProducts.length > 0 && (
          <Section title="Similar Products" style={[styles.padded, { marginTop: SPACING.xxl }]}>
            <FlatList
              data={similarProducts}
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
                      {pctOff(item) > 0 ? <Text style={styles.simMrp}>{formatINR(item.mrp)} </Text> : null}
                      <Text style={styles.simPrice}>{formatINR(item.price)} </Text>
                      {pctOff(item) > 0 ? <Text style={styles.simOff}>{pctOff(item)}% OFF</Text> : null}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => openProduct(item)}
                    style={styles.simAddBtn}
                  >
                    <Text style={styles.simAddText}>View</Text>
                  </TouchableOpacity>
                </View>
              )}
            />
          </Section>
          )}

          {/* Ratings and reviews: shown only once the product has published reviews. */}
          {product.reviewCount > 0 && (
          <>
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
            {distribution ? (
              <View style={styles.distribution}>
                {[5, 4, 3, 2, 1].map(star => {
                  const count = distribution[star] ?? 0;
                  return (
                    <View key={star} style={styles.distRow}>
                      <Text style={styles.distLabel}>{star}</Text>
                      <Text style={styles.distStar}>★</Text>
                      <View style={styles.distTrack}>
                        <View
                          style={[
                            styles.distFill,
                            { width: `${Math.round((count / product.ratingCount) * 100)}%` },
                          ]}
                        />
                      </View>
                      <Text style={styles.distCount}>{count}</Text>
                    </View>
                  );
                })}
              </View>
            ) : null}
            {reviewPhotos.length > 0 ? (
              <FlatList
                data={reviewPhotos}
                horizontal
                keyExtractor={(u, i) => `rv-${i}`}
                showsHorizontalScrollIndicator={false}
                style={{ marginTop: SPACING.l }}
                renderItem={({ item }) => (
                  <Image source={{ uri: item }} style={styles.reviewPhoto} />
                )}
              />
            ) : null}
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
              data={reviews}
              horizontal
              keyExtractor={r => r.id}
              showsHorizontalScrollIndicator={false}
              renderItem={({ item }) => (
                <View style={[styles.reviewCard, { width: width * 0.72 }]}>
                  <View style={styles.reviewTop}>
                    <View style={styles.reviewStars}>
                      <Text style={styles.reviewStarsText}>{item.rating}</Text>
                      <Icon name="star" size={12} color={COLORS.white} />
                    </View>
                    <Text style={styles.reviewDate}>{item.date}</Text>
                  </View>
                  <Text style={styles.reviewBody} numberOfLines={3}>
                    {item.title ? <Text style={styles.reviewTitle}>{item.title}{'\n'}</Text> : null}
                    {item.text}
                    <Text style={styles.readMore} onPress={handleViewReviews}>
                      {' '}
                      read more
                    </Text>
                  </Text>
                  <View style={styles.reviewAuthorRow}>
                    <Icon name="check-circle" size={16} color={GREEN} />
                    <Text style={styles.reviewAuthor}>{item.authorDisplayName}</Text>
                  </View>
                </View>
              )}
            />
          </Section>

          </>
          )}

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleViewQuestions}
            style={styles.questionsLink}
          >
            <View>
              <Text style={styles.questionsTitle}>Questions &amp; Answers</Text>
              <Text style={styles.questionsSubtitle}>
                Ask buyers and sellers about this product
              </Text>
            </View>
            <Icon name="chevron-right" size={20} color={COLORS.textTertiary} />
          </TouchableOpacity>

          {/* More information */}
          <Dropdown title="More Information" style={{ marginTop: SPACING.xxl }}>
            {product.productCode ? <Text style={styles.infoText}>Product Code: {product.productCode}</Text> : null}
            {product.manufacturer ? (
              <>
                <InfoBlock title="Manufacturer Detail">{product.manufacturer}</InfoBlock>
                <InfoBlock title="Packer Detail">{product.manufacturer}</InfoBlock>
              </>
            ) : null}
            {product.countryOfOrigin ? (
              <InfoBlock title="Country of Origin">{product.countryOfOrigin}</InfoBlock>
            ) : null}
          </Dropdown>

          {/* Products you may like */}
          {similarProducts.length + suggestedProducts.length > 0 && (
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
                    {pctOff(item) > 0 ? <Text style={styles.simMrp}>{formatINR(item.mrp)} </Text> : null}
                    <Text style={styles.gridPrice}>{formatINR(item.price)} </Text>
                    {pctOff(item) > 0 ? <Text style={styles.simOff}>{pctOff(item)}% OFF</Text> : null}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Section>
          )}
        </Animated.ScrollView>

        {/* The single CTA pair: rides the bottom edge until it meets the in-page slot, then scrolls with the page */}
        <Animated.View style={[styles.ctaOverlay, ctaStyle]} pointerEvents="box-none">
          <View
            style={[styles.ctaBackdrop, { height: CTA_HEIGHT + SPACING.s + pinOffset }]}
            pointerEvents="none"
          />
          <View style={[styles.ctaRowFixed, styles.padded]}>{ctaButtons}</View>
        </Animated.View>
      </View>

      {/* Rendered from the chart's own columns/rows, so a footwear chart (UK/IN,
          EU, Foot length) displays correctly, not just the shirts layout this
          screen used to assume. */}
      <BottomSheetModal visible={sizeChartVisible} onClose={() => setSizeChartVisible(false)}>
        {product.sizeChart ? (
          <View style={styles.sheetContent}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{product.sizeChart.name || 'Size Chart'}</Text>
            <Text style={styles.sheetSubtitle}>
              {product.sizeChart.unit
                ? `All measurements are in ${product.sizeChart.unit}`
                : 'All measurements as listed by the seller'}
            </Text>

            <View style={styles.chartTable}>
              <View style={[styles.chartRow, styles.chartHeaderRow]}>
                {product.sizeChart.columns.map((column, i) => (
                  <Text key={i} style={[styles.chartCell, styles.chartHeaderCell]}>
                    {column}
                  </Text>
                ))}
              </View>
              {product.sizeChart.rows
                .filter(row => product.sizes.includes(row[0]))
                .map(row => (
                  <View
                    key={row[0]}
                    style={[styles.chartRow, row[0] === selectedSize && styles.chartRowActive]}
                  >
                    {row.map((cell, i) => (
                      <Text key={i} style={styles.chartCell}>
                        {cell}
                      </Text>
                    ))}
                  </View>
                ))}
            </View>
          </View>
        ) : null}
      </BottomSheetModal>

      <BottomSheetModal visible={offersVisible} onClose={() => setOffersVisible(false)}>
        <View style={styles.sheetContent}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Available Offers</Text>
          {BANK_OFFERS.map(offer => (
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

const ProductDetailScreen = ({ route, navigation }) => {
  const productId = route?.params?.productId || route?.params?.product?.id;
  const {
    data: product,
    error,
    isLoading,
    refetch,
  } = useGetProductQuery(productId, {
    skip: !productId,
  });

  if (!productId) {
    return (
      <ErrorState
        title="Product unavailable"
        message="This product link is incomplete. Return to the catalog and try again."
      />
    );
  }
  if (isLoading) return <FullScreenLoader message="Loading product..." />;
  if (error || !product) {
    return (
      <ErrorState
        title={error?.status === 404 ? 'Product not found' : undefined}
        message={error?.message}
        onRetry={refetch}
      />
    );
  }
  return <ProductDetailContent product={product} navigation={navigation} route={route} />;
};

const styles = StyleSheet.create({
  questionsLink: {
    marginTop: SPACING.xxl,
    marginHorizontal: SPACING.l,
    padding: SPACING.l,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.m,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
  },
  questionsTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  questionsSubtitle: { fontSize: 12, color: COLORS.textSecondary, marginTop: 3 },
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
  optionCard: {
    minWidth: 110,
    borderRadius: RADIUS.s,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    paddingVertical: SPACING.s,
    paddingHorizontal: SPACING.m,
    backgroundColor: COLORS.surface,
  },
  optionCardActive: { borderColor: COLORS.textPrimary, backgroundColor: COLORS.mutedBg },
  optionCardOut: { opacity: 0.6 },
  optionCardTitle: { fontSize: 12.5, color: COLORS.textPrimary },
  optionCardTitleActive: { fontWeight: '700' },
  optionCardPriceBox: {
    marginTop: SPACING.xs,
    paddingTop: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  optionCardMrpRow: { fontSize: 11 },
  optionCardDiscount: { fontWeight: '700', color: GREEN },
  optionCardMrp: { color: COLORS.textSecondary, textDecorationLine: 'line-through' },
  optionCardPrice: { fontSize: 13.5, fontWeight: '700', color: COLORS.textPrimary },
  optionCardOutText: { fontSize: 10, color: COLORS.error },
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
  descHeading: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: COLORS.textPrimary,
    marginTop: SPACING.m,
    marginBottom: 2,
  },
  specCard: {
    marginTop: SPACING.xxl,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.m,
    overflow: 'hidden',
    backgroundColor: COLORS.white,
  },
  specTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
    paddingHorizontal: SPACING.l,
    paddingVertical: SPACING.m,
    backgroundColor: COLORS.mutedBg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  specTableRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  specTableRowLast: { borderBottomWidth: 0 },
  specTableLabel: {
    width: '38%',
    fontSize: 13,
    color: COLORS.textSecondary,
    backgroundColor: COLORS.mutedBg,
    paddingHorizontal: SPACING.l,
    paddingVertical: SPACING.m,
  },
  specTableValue: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
    paddingHorizontal: SPACING.l,
    paddingVertical: SPACING.m,
  },

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

  distribution: { marginTop: SPACING.l, gap: 6 },
  distRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  distLabel: { width: 10, fontSize: 12, color: COLORS.textPrimary, textAlign: 'right' },
  distStar: { fontSize: 12, color: COLORS.starGold },
  distTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.mutedBg,
    overflow: 'hidden',
  },
  distFill: { height: 6, borderRadius: 3, backgroundColor: COLORS.starGold },
  distCount: { width: 28, fontSize: 12, color: COLORS.textSecondary, textAlign: 'right' },
  reviewTitle: { fontWeight: '700', color: COLORS.textPrimary },

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
