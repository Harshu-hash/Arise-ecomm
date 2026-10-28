import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  StatusBar,
  Share,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../../../constants/colors';
import { SPACING, RADIUS } from '../../../constants/spacing';
import { StatusBarManager, GradientBackground, ProductCard } from '../../../shared/components';
import { PRODUCT_FEED } from '../../home/data/homeData';

const DEFAULT_GRADIENT = ['#7A0C1E', '#CC0C39', '#FF6A3D'];
const buildGradient = (accent) => (accent ? ['#7A0C1E', accent, '#FF8A3D'] : DEFAULT_GRADIENT);
const COUPON_CODE = 'VALUE365';
const TRUST_CHIPS = [
  { icon: 'truck', label: 'Free Delivery' },
  { icon: 'refresh-cw', label: 'Easy Returns' },
  { icon: 'shield', label: 'Assured' },
];

const pad = (n) => String(n).padStart(2, '0');
const useCountdown = (seconds) => {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    const id = setInterval(() => setLeft((v) => (v > 0 ? v - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, []);
  const h = Math.floor(left / 3600);
  const m = Math.floor((left % 3600) / 60);
  const s = left % 60;
  return { h: pad(h), m: pad(m), s: pad(s) };
};

const DealDetailScreen = ({ navigation, route }) => {
  const deal = (route && route.params && route.params.deal) || {
    id: 'tvd1',
    label: 'Mega Deal',
    value: 'Up to 80% Off',
    tag: 'BESTSELLER',
    image: 'https://images.unsplash.com/photo-1591637333184-19aa84b3e01f?auto=format&fit=crop&w=800&q=80',
  };
  const HERO_GRADIENT = buildGradient(deal.accent);

  const { h, m, s } = useCountdown(4 * 3600 + 32 * 60 + 12);
  const pulse = useRef(new Animated.Value(1)).current;
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.06, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const related = useMemo(() => PRODUCT_FEED.slice(0, 6), []);

  const handleShare = () => {
    Share.share({ message: `Check out this deal: ${deal.label} — ${deal.value}` }).catch(() => {});
  };
  const handleCopy = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  const handleGrab = () => navigation && navigation.navigate('SearchResults', { deal });

  return (
    <View style={styles.root}>
      <StatusBarManager barStyle="light-content" themeColor={HERO_GRADIENT[0]} />
      <StatusBar translucent backgroundColor="transparent" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollBody}
        bounces>
        <View style={styles.hero}>
          <GradientBackground colors={HERO_GRADIENT} id={`deal_grad_${deal.id}`} />
          <SafeAreaView edges={['top']} style={styles.heroSafe}>
            <View style={styles.heroTopRow}>
              <TouchableOpacity style={styles.iconBtn} onPress={() => navigation && navigation.goBack()}>
                <Icon name="arrow-left" size={20} color={COLORS.white} />
              </TouchableOpacity>
              <View style={styles.heroTopActions}>
                <TouchableOpacity style={styles.iconBtn} onPress={handleShare}>
                  <Icon name="share-2" size={18} color={COLORS.white} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconBtn}>
                  <Icon name="heart" size={18} color={COLORS.white} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.heroContent}>
              {deal.tag ? (
                <View style={styles.tagPill}>
                  <Icon name="zap" size={11} color={COLORS.ctaYellow} />
                  <Text style={styles.tagText}>{deal.tag}</Text>
                </View>
              ) : null}
              <Text style={styles.heroTitle} numberOfLines={2}>{deal.label}</Text>
              <Text style={styles.heroSubtitle}>
                {deal.section ? `${deal.section} · Verified sellers` : 'Handpicked value picks · Verified sellers'}
              </Text>

              <Animated.View style={[styles.discountBubble, { transform: [{ scale: pulse }] }]}>
                <Image source={{ uri: deal.image }} style={styles.discountImage} />
                <View style={styles.discountOverlay}>
                  <Text style={styles.discountValue} numberOfLines={2}>{deal.value}</Text>
                </View>
              </Animated.View>
            </View>
          </SafeAreaView>
        </View>

        <View style={styles.timerStrip}>
          <Icon name="clock" size={14} color={COLORS.offerRed} />
          <Text style={styles.timerLabel}>Grab this deal in</Text>
          <View style={styles.timerBlocks}>
            {[h, m, s].map((v, i) => (
              <React.Fragment key={i}>
                <View style={styles.timerBlock}><Text style={styles.timerNum}>{v}</Text></View>
                {i < 2 ? <Text style={styles.timerColon}>:</Text> : null}
              </React.Fragment>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <View>
              <Text style={styles.couponEyebrow}>SAVE EXTRA WITH</Text>
              <Text style={styles.couponCode}>{COUPON_CODE}</Text>
              <Text style={styles.couponHint}>Apply at checkout for an extra 10% off</Text>
            </View>
            <TouchableOpacity onPress={handleCopy} style={[styles.copyBtn, copied && styles.copyBtnDone]}>
              <Icon name={copied ? 'check' : 'copy'} size={13} color={COLORS.white} />
              <Text style={styles.copyText}>{copied ? 'Copied' : 'COPY'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.trustRow}>
          {TRUST_CHIPS.map((c) => (
            <View key={c.label} style={styles.trustChip}>
              <Icon name={c.icon} size={14} color={COLORS.primary} />
              <Text style={styles.trustText}>{c.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.highlightCard}>
          <View style={styles.highlightIconWrap}>
            <Icon name="trending-up" size={18} color={COLORS.ratingGreen} />
          </View>
          <View style={styles.highlightBody}>
            <Text style={styles.highlightTitle}>Trending across the country</Text>
            <Text style={styles.highlightSub}>Over 2 lakh shoppers grabbed this deal this week.</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Products in this deal</Text>
          <Text style={styles.sectionCount}>{related.length} items</Text>
        </View>

        <View style={styles.grid}>
          {related.map((p) => (
            <ProductCard
              key={p.id}
              product={{ name: p.title, price: p.price, mrp: p.mrp, image: p.image, discount: p.badge }}
              onPress={() => navigation && navigation.navigate('ProductDetail', { productId: p.id })}
              style={styles.gridCard}
            />
          ))}
        </View>
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={styles.footer}>
        <View style={styles.footerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.footerHint}>Limited stock</Text>
            <Text style={styles.footerSave}>Save up to ₹4,999</Text>
          </View>
          <TouchableOpacity activeOpacity={0.9} style={styles.ctaBtn} onPress={handleGrab}>
            <Text style={styles.ctaText}>Shop This Deal</Text>
            <Icon name="arrow-right" size={16} color={COLORS.textPrimary} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.mutedBg },
  scrollBody: { paddingBottom: 120 },

  hero: { overflow: 'hidden', paddingBottom: SPACING.xxl, borderBottomLeftRadius: RADIUS.xl, borderBottomRightRadius: RADIUS.xl },
  heroSafe: { paddingHorizontal: SPACING.l, paddingTop: SPACING.s },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroTopActions: { flexDirection: 'row', gap: SPACING.s },
  iconBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  heroContent: { alignItems: 'center', marginTop: SPACING.l, paddingHorizontal: SPACING.m },
  tagPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.28)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.round },
  tagText: { color: COLORS.ctaYellow, fontSize: 10.5, fontWeight: '800', letterSpacing: 0.6 },
  heroTitle: { color: COLORS.white, fontSize: 26, fontWeight: '800', textAlign: 'center', marginTop: SPACING.s, letterSpacing: 0.2 },
  heroSubtitle: { color: 'rgba(255,255,255,0.85)', fontSize: 12.5, marginTop: 4, textAlign: 'center' },

  discountBubble: { marginTop: SPACING.xl, width: 200, height: 200, borderRadius: 100, overflow: 'hidden', borderWidth: 4, borderColor: 'rgba(255,255,255,0.35)' },
  discountImage: { width: '100%', height: '100%' },
  discountOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(122,12,30,0.55)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.m },
  discountValue: { color: COLORS.white, fontSize: 22, fontWeight: '900', textAlign: 'center' },

  timerStrip: { flexDirection: 'row', alignItems: 'center', gap: SPACING.s, backgroundColor: COLORS.offerRedLight, marginHorizontal: SPACING.l, marginTop: -SPACING.l, paddingHorizontal: SPACING.m, paddingVertical: SPACING.s, borderRadius: RADIUS.m, elevation: 3, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  timerLabel: { color: COLORS.textPrimary, fontSize: 12.5, fontWeight: '600', flex: 1 },
  timerBlocks: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timerBlock: { backgroundColor: COLORS.offerRed, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4, minWidth: 26, alignItems: 'center' },
  timerNum: { color: COLORS.white, fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  timerColon: { color: COLORS.offerRed, fontSize: 14, fontWeight: '800' },

  card: { backgroundColor: COLORS.white, marginHorizontal: SPACING.l, marginTop: SPACING.m, padding: SPACING.l, borderRadius: RADIUS.m, borderWidth: 1, borderColor: COLORS.cardBorder },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  couponEyebrow: { fontSize: 10.5, fontWeight: '700', color: COLORS.textSecondary, letterSpacing: 1 },
  couponCode: { fontSize: 20, fontWeight: '800', color: COLORS.primary, marginTop: 2, letterSpacing: 1.2 },
  couponHint: { fontSize: 11.5, color: COLORS.textSecondary, marginTop: 2 },
  copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.primary, paddingHorizontal: SPACING.m, paddingVertical: 8, borderRadius: RADIUS.s },
  copyBtnDone: { backgroundColor: COLORS.ratingGreen },
  copyText: { color: COLORS.white, fontSize: 11.5, fontWeight: '800', letterSpacing: 0.5 },

  trustRow: { flexDirection: 'row', gap: SPACING.s, marginHorizontal: SPACING.l, marginTop: SPACING.m },
  trustChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: COLORS.white, paddingVertical: SPACING.s, borderRadius: RADIUS.s, borderWidth: 1, borderColor: COLORS.cardBorder },
  trustText: { fontSize: 11.5, fontWeight: '600', color: COLORS.textPrimary },

  highlightCard: { flexDirection: 'row', alignItems: 'center', gap: SPACING.m, backgroundColor: COLORS.ratingGreenBg, marginHorizontal: SPACING.l, marginTop: SPACING.m, padding: SPACING.m, borderRadius: RADIUS.m },
  highlightIconWrap: { width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center' },
  highlightBody: { flex: 1 },
  highlightTitle: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary },
  highlightSub: { fontSize: 11.5, color: COLORS.textSecondary, marginTop: 2 },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: SPACING.l, marginTop: SPACING.xl, marginBottom: SPACING.s },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  sectionCount: { fontSize: 12, color: COLORS.textSecondary },

  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: SPACING.l - 4, justifyContent: 'space-between' },
  gridCard: { width: '48%', marginHorizontal: 4, marginBottom: SPACING.m },

  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.cardBorder },
  footerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.l, paddingVertical: SPACING.m, gap: SPACING.m },
  footerHint: { fontSize: 11, color: COLORS.offerRed, fontWeight: '700', letterSpacing: 0.4 },
  footerSave: { fontSize: 15, color: COLORS.textPrimary, fontWeight: '800' },
  ctaBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.ctaYellow, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.m, borderRadius: RADIUS.round },
  ctaText: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '800' },
});

export default DealDetailScreen;
