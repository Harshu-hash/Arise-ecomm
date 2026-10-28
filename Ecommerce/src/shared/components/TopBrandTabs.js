import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Animated, Easing } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Feather';
import { COLORS } from '../../constants/colors';
import { SPACING, RADIUS } from '../../constants/spacing';
import GradientBackground from './GradientBackground';
import { useBrandSwitchLoader } from '../../contexts/BrandSwitchLoaderContext';
import { haptics } from '../../utils/haptics';

const TRACK_PADDING = 3;
const TRACK_GAP = 4;
const SLIDE_DURATION = 300;
// Loader fades in first, then the screen swap happens hidden behind it, then it lingers so the
// destination screen has time to render before the loader fades away.
const LOADER_FADE_IN_WAIT = 300;
const LOADER_LINGER = 750;

/**
 * Modern Segmented "Flipkart / Value 365" Brand Switcher Bar
 * tabs: [{ id, label, icon, badge, activeBg, activeText, activeIcon, badgeBg, badgeText, gradient }]
 *
 * A single capsule (`indicator`) slides between slots on tab change — it's one Animated.View
 * carrying every tab's gradient stacked underneath, cross-fading opacity in step with the
 * slide so the color settles exactly as the capsule arrives.
 *
 * `onSelect` usually triggers navigation to a whole other screen (Home <-> Offers). We let the
 * capsule glide to the pressed tab first (so the switch reads as one continuous, butter-smooth
 * motion) and fire `onSelect` the instant that animation finishes — the screen transition
 * itself is instant (`animation: 'none'`), so nothing after the capsule settles feels delayed.
 *
 * Native-stack keeps the previous screen mounted (not destroyed) underneath the one pushed
 * on top of it, so pressing a tab and navigating away leaves this local state sitting at the
 * tab that was just pressed — if the user then navigates back here via the other screen's own
 * tab bar, this instance would still show that stale tab as active instead of the real one.
 * Re-syncing on every focus (not just prop change, since the prop is a static literal on both
 * screens and never actually changes) is what corrects that when the screen reappears.
 */
const TopBrandTabs = ({ tabs, activeId, onSelect }) => {
  const [trackWidth, setTrackWidth] = useState(0);
  const [localActiveId, setLocalActiveId] = useState(activeId);
  // When focus re-sync corrects stale state left over from before this screen was last
  // visible, that correction should snap instantly — it was never truly "seen" as active,
  // so animating it plays as a second, spurious slide right after the one the user just
  // watched on the other screen (reads as jitter). Only an actual tap should animate.
  const skipNextAnimRef = useRef(false);
  const pendingTabRef = useRef(null);
  const { showBrandLoader, hideBrandLoader } = useBrandSwitchLoader();

  useFocusEffect(
    useCallback(() => {
      skipNextAnimRef.current = true;
      setLocalActiveId(activeId);
    }, [activeId])
  );

  const activeIndex = Math.max(0, tabs.findIndex((t) => t.id === localActiveId));
  const slideAnim = useRef(new Animated.Value(activeIndex)).current;

  useEffect(() => {
    if (skipNextAnimRef.current) {
      skipNextAnimRef.current = false;
      slideAnim.setValue(activeIndex);
      return;
    }
    Animated.timing(slideAnim, {
      toValue: activeIndex,
      duration: SLIDE_DURATION,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && pendingTabRef.current) {
        const tab = pendingTabRef.current;
        pendingTabRef.current = null;
        showBrandLoader(tab);
        setTimeout(() => {
          onSelect && onSelect(tab);
          hideBrandLoader(LOADER_LINGER);
        }, LOADER_FADE_IN_WAIT);
      }
    });
  }, [activeIndex, slideAnim]);

  const handlePress = (tab) => {
    if (tab.id === localActiveId) {
      onSelect && onSelect(tab);
      return;
    }

    haptics.selection();
    skipNextAnimRef.current = false;
    pendingTabRef.current = tab;
    setLocalActiveId(tab.id);
  };

  const handleTrackLayout = (e) => setTrackWidth(e.nativeEvent.layout.width);

  const tabCount = tabs.length;
  const slotWidth = trackWidth > 0
    ? (trackWidth - TRACK_PADDING * 2 - TRACK_GAP * (tabCount - 1)) / tabCount
    : 0;

  const positionsInput = tabs.map((_, i) => i);
  const positionsOutput = tabs.map((_, i) => i * (slotWidth + TRACK_GAP));
  const translateX = slideAnim.interpolate({
    inputRange: positionsInput.length > 1 ? positionsInput : [0, 1],
    outputRange: positionsOutput.length > 1 ? positionsOutput : [0, 0],
  });

  const activeTab = tabs[activeIndex] || tabs[0];
  const activeIsFlipkart = activeTab?.id === 'flipkart';

  return (
    <View style={styles.container}>
      <View style={styles.track} onLayout={handleTrackLayout}>
        <View style={styles.trackBase} pointerEvents="none" />

        {slotWidth > 0 && (
          <Animated.View
            style={[
              styles.indicator,
              activeIsFlipkart ? styles.flipkartShadow : styles.value365Shadow,
              { width: slotWidth, transform: [{ translateX }] },
            ]}
            pointerEvents="none">
            {tabs.map((tab, i) => {
              const isFlipkartTab = tab.id === 'flipkart';
              const grad = tab.gradient || (isFlipkartTab ? ['#FFE11B', '#FFC200'] : ['#E52E2E', '#900C1F']);
              const opacity = slideAnim.interpolate({
                inputRange: positionsInput.length > 1 ? positionsInput : [0, 1],
                outputRange: positionsInput.map((v) => (v === i ? 1 : 0)),
                extrapolate: 'clamp',
              });
              return (
                <Animated.View key={tab.id} style={[StyleSheet.absoluteFill, { opacity }]}>
                  <GradientBackground colors={grad} id={`brand_tab_grad_${tab.id}`} />
                  {!isFlipkartTab && <View style={styles.value365Shine} pointerEvents="none" />}
                </Animated.View>
              );
            })}
          </Animated.View>
        )}

        {tabs.map((tab) => {
          const isActive = tab.id === localActiveId;
          const isFlipkart = tab.id === 'flipkart';

          const activeTextColor = tab.activeText || (isFlipkart ? '#002F6C' : '#FFFFFF');
          const activeIconColor = tab.activeIcon || (isFlipkart ? '#002F6C' : '#FFD700');
          const badgeBgColor = tab.badgeBg || (isFlipkart ? '#002F6C' : '#FFD700');
          const badgeTextColor = tab.badgeText || (isFlipkart ? '#FFE11B' : '#8B0000');
          const badgeLabel = tab.badge || (isFlipkart ? 'PLUS' : 'DEALS');

          return (
            <TouchableOpacity
              key={tab.id}
              activeOpacity={0.88}
              onPress={() => handlePress(tab)}
              style={styles.tabCard}>
              <View style={styles.contentRow}>
                <View style={styles.iconContainer}>
                  {tab.iconImage ? (
                    <Image source={tab.iconImage} style={styles.iconImage} resizeMode="contain" />
                  ) : (
                    <Icon
                      name={tab.icon}
                      size={14}
                      color={isActive ? activeIconColor : (isFlipkart ? '#002F6C' : '#D32F2F')}
                    />
                  )}
                </View>

                <Text
                  style={[
                    styles.label,
                    { color: isActive ? activeTextColor : COLORS.textPrimary },
                    isActive && styles.activeLabel,
                  ]}
                  numberOfLines={1}>
                  {tab.label}
                </Text>

                {badgeLabel ? (
                  <View style={[styles.badgeChip, { backgroundColor: isActive ? badgeBgColor : 'rgba(0,0,0,0.06)' }]}>
                    {tab.badgeIcon ? (
                      <Icon
                        name={tab.badgeIcon}
                        size={8}
                        color={isActive ? badgeTextColor : COLORS.textSecondary}
                        style={styles.badgeIcon}
                      />
                    ) : null}
                    <Text style={[styles.badgeText, { color: isActive ? badgeTextColor : COLORS.textSecondary }]}>
                      {badgeLabel}
                    </Text>
                  </View>
                ) : null}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: SPACING.l,
  },
  track: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.16)',
    borderRadius: 24,
    padding: TRACK_PADDING,
    gap: TRACK_GAP,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    position: 'relative',
  },
  trackBase: {
    position: 'absolute',
    top: TRACK_PADDING,
    left: TRACK_PADDING,
    right: TRACK_PADDING,
    bottom: TRACK_PADDING,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
  },
  indicator: {
    position: 'absolute',
    top: TRACK_PADDING,
    bottom: TRACK_PADDING,
    left: TRACK_PADDING,
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 4,
  },
  tabCard: {
    flex: 1,
    height: 42,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  flipkartShadow: {
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
  },
  value365Shadow: {
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 7,
    elevation: 6,
  },
  value365Shine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '48%',
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 6,
    zIndex: 2,
  },
  iconContainer: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconImage: {
    width: 20,
    height: 20,
  },
  label: {
    fontSize: 12.5,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  activeLabel: {
    fontWeight: '800',
  },
  badgeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeIcon: {
    marginRight: 1,
  },
  badgeText: {
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
});

export default TopBrandTabs;
