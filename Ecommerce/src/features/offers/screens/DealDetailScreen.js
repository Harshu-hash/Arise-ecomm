import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Share,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../../../constants/colors';
import { SPACING, RADIUS } from '../../../constants/spacing';
import { StatusBarManager, GradientBackground } from '../../../shared/components';
import ProductFeedSection from '../../home/components/ProductFeedSection';
import FullScreenLoader from '../../../shared/loaders/FullScreenLoader';
import ErrorState from '../../../shared/ErrorState/ErrorState';
import { useGetPromotionQuery } from '../api/offers.api';

const DEFAULT_GRADIENT = ['#7A0C1E', '#CC0C39', '#FF6A3D'];
const buildGradient = (accent) => (accent ? ['#7A0C1E', accent, '#FF8A3D'] : DEFAULT_GRADIENT);

const pad = (n) => String(n).padStart(2, '0');
const useCountdown = (seconds) => {
  const [left, setLeft] = useState(seconds);
  useEffect(() => setLeft(seconds), [seconds]);
  useEffect(() => {
    const id = setInterval(() => setLeft((v) => (v > 0 ? v - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, []);
  const d = Math.floor(left / 86400);
  const h = Math.floor((left % 86400) / 3600);
  const m = Math.floor((left % 3600) / 60);
  const s = left % 60;
  return { d, h: pad(h), m: pad(m), s: pad(s) };
};

const DealDetailScreen = ({ navigation, route }) => {
  const routeDeal = (route && route.params && route.params.deal) || {
    id: 'tvd1',
    label: 'Mega Deal',
    value: 'Up to 80% Off',
    tag: 'BESTSELLER',
    image: 'https://images.unsplash.com/photo-1591637333184-19aa84b3e01f?auto=format&fit=crop&w=800&q=80',
  };
  const dealId = route?.params?.dealId || routeDeal.id;
  const { data: promotion, isLoading, error, refetch } = useGetPromotionQuery(dealId);
  const deal = promotion
    ? {
        ...routeDeal,
        id: promotion.id,
        label: promotion.title,
        value: promotion.items[0]?.bannerText || routeDeal.value,
        image: promotion.items[0]?.image || routeDeal.image,
        tag: promotion.tag,
        section: promotion.title,
        accent: promotion.accent,
        heroImage: promotion.heroImageUrl,
      }
    : routeDeal;
  // The admin's own gradient when set (top, middle, bottom), else the default built from the accent.
  const HERO_GRADIENT = promotion?.gradient ? [promotion.gradient[0], promotion.gradient[0], promotion.gradient[1]] : buildGradient(deal.accent);

  const secondsRemaining = promotion?.endsAt
    ? Math.max(0, Math.floor((new Date(promotion.endsAt).getTime() - Date.now()) / 1000))
    : 0;
  const { d, h, m, s } = useCountdown(secondsRemaining);

  const related = useMemo(() => (promotion?.relatedProducts || []).map((p) => ({ ...p, title: p.name })), [promotion?.relatedProducts]);

  const handleShare = () => {
    Share.share({ message: `Check out this deal: ${deal.label} — ${deal.value}` }).catch(() => {});
  };
  const handleGrab = () => navigation && navigation.navigate('SearchResults', { deal });

  if (isLoading) return <FullScreenLoader message="Loading deal..." />;
  if (error && !promotion) return <ErrorState message={error.message} onRetry={refetch} />;

  return (
    <View style={styles.root}>
      <StatusBarManager barStyle="light-content" themeColor={HERO_GRADIENT[0]} />
      <StatusBar translucent backgroundColor="transparent" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollBody}
        bounces>
        <View style={[styles.hero, deal.heroImage && styles.heroWithImage]}>
          {/* The admin's hero banner fills the hero as is; only a campaign without one gets the gradient. */}
          {deal.heroImage ? (
            <Image source={{ uri: deal.heroImage }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : (
            <GradientBackground colors={HERO_GRADIENT} id={`deal_grad_${deal.id}`} />
          )}
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

            </View>
          </SafeAreaView>
        </View>

        <View style={styles.timerStrip}>
          <Icon name="clock" size={14} color={COLORS.offerRed} />
          <Text style={styles.timerLabel}>Grab this deal in</Text>
          <View style={styles.timerBlocks}>
            {[...(d ? [`${d}d`] : []), h, m, s].map((v, i, all) => (
              <React.Fragment key={i}>
                <View style={styles.timerBlock}><Text style={styles.timerNum}>{v}</Text></View>
                {i < all.length - 1 ? <Text style={styles.timerColon}>:</Text> : null}
              </React.Fragment>
            ))}
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Products in this deal</Text>
          <Text style={styles.sectionCount}>{related.length} items</Text>
        </View>

        <ProductFeedSection
          title={null}
          products={related}
          onPressProduct={(p) => navigation && navigation.navigate('ProductDetail', { productId: p.id })}
        />
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
  heroWithImage: { minHeight: 300 }, // room for the banner now that the deal bubble is gone
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


  timerStrip: { flexDirection: 'row', alignItems: 'center', gap: SPACING.s, backgroundColor: COLORS.offerRedLight, marginHorizontal: SPACING.l, marginTop: -SPACING.l, paddingHorizontal: SPACING.m, paddingVertical: SPACING.s, borderRadius: RADIUS.m, elevation: 3, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  timerLabel: { color: COLORS.textPrimary, fontSize: 12.5, fontWeight: '600', flex: 1 },
  timerBlocks: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timerBlock: { backgroundColor: COLORS.offerRed, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4, minWidth: 26, alignItems: 'center' },
  timerNum: { color: COLORS.white, fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  timerColon: { color: COLORS.offerRed, fontSize: 14, fontWeight: '800' },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: SPACING.l, marginTop: SPACING.xl, marginBottom: SPACING.s },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  sectionCount: { fontSize: 12, color: COLORS.textSecondary },


  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.cardBorder },
  footerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.l, paddingVertical: SPACING.m, gap: SPACING.m },
  footerHint: { fontSize: 11, color: COLORS.offerRed, fontWeight: '700', letterSpacing: 0.4 },
  footerSave: { fontSize: 15, color: COLORS.textPrimary, fontWeight: '800' },
  ctaBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.ctaYellow, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.m, borderRadius: RADIUS.round },
  ctaText: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '800' },
});

export default DealDetailScreen;
