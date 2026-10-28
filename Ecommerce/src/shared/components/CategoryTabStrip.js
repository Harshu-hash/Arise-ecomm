import React, { useRef, useEffect, useState } from 'react';
import { ScrollView, Text, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { COLORS } from '../../constants/colors';
import { SPACING } from '../../constants/spacing';

const EXPANDED_HEIGHT = 66;
const UNDERLINE_BASE_WIDTH = 100;
const UNDERLINE_DURATION = 360;
const UNDERLINE_EASING = Easing.bezier(0.22, 1, 0.36, 1);

/**
 * "For You | Fashion | Mobiles | Electronics | Beauty ..." underline tab strip on Home.
 * A single shared underline slides + resizes to the clicked tab (measured tab positions,
 * animated with Animated.timing) instead of each tab toggling its own static bar.
 * When `scrollY` is provided, the icons shrink + fade away and the labels rise, in sync
 * with the header's own collapse — all transform/opacity only, driven by the SAME native
 * scrollY value as the header's translate, so they can never drift out of sync with it.
 *
 * NOTE: an earlier version also shrank the row's own height via a second, JS-driven
 * value (since `height` isn't native-driver compatible). That couldn't share a driver
 * with the native header translate, so under fast/scrolled states the two visibly
 * desynced — leaving gaps between the header and the content below it. Do not
 * reintroduce a height animation here; keep this row's own box height static and let
 * only transform/opacity move within it.
 */
const CategoryTabStrip = ({
  tabs,
  activeId,
  onSelect,
  style,
  scrollY,
  collapseDistance = 100,
}) => {
  const isIconAnimated = !!scrollY;
  const iconScale = isIconAnimated
    ? scrollY.interpolate({
        inputRange: [0, collapseDistance * 0.7],
        outputRange: [1, 0.4],
        extrapolate: 'clamp',
      })
    : 1;
  const iconOpacity = isIconAnimated
    ? scrollY.interpolate({
        inputRange: [0, collapseDistance * 0.45],
        outputRange: [1, 0],
        extrapolate: 'clamp',
      })
    : 1;
  // Give the label extra clearance from the shrinking clip window's bottom edge —
  // otherwise it sits right at the boundary and gets sliced through mid-letter.
  const labelTranslateY = isIconAnimated
    ? scrollY.interpolate({
        inputRange: [0, collapseDistance * 0.7],
        outputRange: [0, -18],
        extrapolate: 'clamp',
      })
    : 0;

  // --- Sliding underline ---
  // One `progress` value (a fractional tab index) drives the bar. Each tab's measured x/width
  // is mapped onto translateX + scaleX through native-supported interpolation, so the whole
  // slide-and-resize runs on the UI thread and can't stutter when the JS thread is busy
  // (animating `width` instead would force useNativeDriver:false, i.e. JS-thread frames).
  const activeIndex = Math.max(0, tabs.findIndex((t) => t.id === activeId));
  const layoutsRef = useRef({});
  const [layouts, setLayouts] = useState({});
  const hasPositionedRef = useRef(false);
  const progress = useRef(new Animated.Value(activeIndex)).current;

  const allMeasured = tabs.length > 0 && tabs.every((t) => layouts[t.id]);

  const handleTabLayout = (id, e) => {
    const { x, width } = e.nativeEvent.layout;
    const prev = layoutsRef.current[id];
    if (prev && prev.x === x && prev.width === width) return;
    layoutsRef.current[id] = { x, width };
    setLayouts({ ...layoutsRef.current });
  };

  useEffect(() => {
    if (!allMeasured) return;
    if (!hasPositionedRef.current) {
      hasPositionedRef.current = true;
      progress.setValue(activeIndex);
      return;
    }
    Animated.timing(progress, {
      toValue: activeIndex,
      duration: UNDERLINE_DURATION,
      easing: UNDERLINE_EASING,
      useNativeDriver: true,
    }).start();
  }, [activeIndex, allMeasured, progress]);

  const underlineStyle = (() => {
    if (!allMeasured) return null;
    const single = tabs.length < 2;
    const inputRange = single ? [0, 1] : tabs.map((_, i) => i);
    const centers = tabs.map((t) => layouts[t.id].x + layouts[t.id].width / 2 - UNDERLINE_BASE_WIDTH / 2);
    const scales = tabs.map((t) => layouts[t.id].width / UNDERLINE_BASE_WIDTH);
    return {
      translateX: progress.interpolate({ inputRange, outputRange: single ? [centers[0], centers[0]] : centers }),
      scaleX: progress.interpolate({ inputRange, outputRange: single ? [scales[0], scales[0]] : scales }),
    };
  })();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[styles.scrollView, style]}
      contentContainerStyle={styles.row}>
      {tabs.map((tab) => {
        const isActive = tab.id === activeId;
        return (
          <TouchableOpacity
            key={tab.id}
            activeOpacity={0.8}
            onPress={() => onSelect && onSelect(tab)}
            onLayout={(e) => handleTabLayout(tab.id, e)}
            style={styles.tab}>
            <Animated.View
              style={[
                styles.iconBox,
                isActive && styles.iconBoxActive,
                isIconAnimated && { opacity: iconOpacity, transform: [{ scale: iconScale }] },
              ]}>
              {tab.icon && (
                <Ionicons
                  name={tab.icon}
                  size={22}
                  color={COLORS.textPrimary}
                />
              )}
            </Animated.View>
            <Animated.View style={isIconAnimated && { transform: [{ translateY: labelTranslateY }] }}>
              <Text style={[styles.label, isActive && styles.labelActive]}>{tab.label}</Text>
            </Animated.View>
          </TouchableOpacity>
        );
      })}

      {/*
        Everything here is native-driven (scrollY-based translateY + progress-based
        translateX/scaleX), so they can safely share one transform array. Do not add a
        JS-driven value (e.g. animating width/left) to this transform — mixing driver
        types in one node throws and would also bring back the stutter.
      */}
      {underlineStyle ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.slidingUnderline,
            {
              transform: [
                { translateY: labelTranslateY },
                { translateX: underlineStyle.translateX },
                { scaleX: underlineStyle.scaleX },
              ],
            },
          ]}
        />
      ) : null}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollView: {
    height: EXPANDED_HEIGHT,
    flexGrow: 0,
  },
  row: {
    paddingHorizontal: SPACING.l,
    paddingBottom: 14,
    alignItems: 'flex-end',
  },
  tab: {
    alignItems: 'center',
    marginRight: SPACING.l,
  },
  iconBox: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: -6,
  },
  iconBoxActive: {},
  label: {
    fontSize: 10.5,
    fontWeight: '500',
    color: 'rgba(33,33,33,0.7)',
  },
  labelActive: {
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  slidingUnderline: {
    position: 'absolute',
    left: 0,
    bottom: 7,
    width: UNDERLINE_BASE_WIDTH,
    height: 3,
    backgroundColor: COLORS.primary,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
});

export default CategoryTabStrip;
