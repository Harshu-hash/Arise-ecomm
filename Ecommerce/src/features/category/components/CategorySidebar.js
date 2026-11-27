import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { COLORS } from '../../../constants/colors';
import { RADIUS } from '../../../constants/spacing';
import CategorySidebarRow from './CategorySidebarRow';

const SLIDE = { duration: 320, easing: Easing.bezier(0.22, 1, 0.36, 1) }; // quick start, long soft landing

/**
 * The "All Categories" sidebar. One white indicator (with the curved cut-outs and accent bar) sits behind the rows and slides to
 * whichever one is selected, instead of each row switching on and off.
 */
const CategorySidebar = ({ categories, selectedId, onSelect }) => {
  const [layouts, setLayouts] = useState({});
  const y = useSharedValue(0);
  const height = useSharedValue(0);
  const placed = useRef(false);
  const selected = layouts[selectedId];

  useEffect(() => {
    if (!selected) return;
    if (!placed.current) {
      // first time it is known: appear in place rather than flying in from the top
      y.value = selected.y;
      height.value = selected.height;
      placed.current = true;
      return;
    }
    y.value = withTiming(selected.y, SLIDE);
    height.value = withTiming(selected.height, SLIDE);
  }, [selected, y, height]);

  const indicator = useAnimatedStyle(() => ({
    height: height.value,
    transform: [{ translateY: y.value }],
  }));

  return (
    <View style={styles.sidebar}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Animated.View style={[styles.indicator, indicator]} pointerEvents="none">
          <View style={styles.cornerAbove}>
            <View style={styles.cornerGrey} />
          </View>
          <View style={styles.accent} />
          <View style={styles.cornerBelow}>
            <View style={[styles.cornerGrey, styles.cornerGreyBelow]} />
          </View>
        </Animated.View>
        {categories.map(item => (
          <View
            key={item.id}
            onLayout={({ nativeEvent: { layout } }) =>
              setLayouts(prev =>
                prev[item.id]?.y === layout.y && prev[item.id]?.height === layout.height
                  ? prev
                  : { ...prev, [item.id]: { y: layout.y, height: layout.height } },
              )
            }
          >
            <CategorySidebarRow
              item={item}
              isSelected={item.id === selectedId}
              onPress={() => onSelect(item.id)}
            />
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const CORNER = RADIUS.xl;
const styles = StyleSheet.create({
  // the fixed width lives on a plain View: on the ScrollView itself it was ignored and the sidebar stretched across the screen
  sidebar: { width: 84, backgroundColor: COLORS.mutedBg },
  content: { flexGrow: 1, backgroundColor: COLORS.mutedBg },
  indicator: { position: 'absolute', left: 0, right: 0, top: 0, backgroundColor: COLORS.white },
  accent: {
    position: 'absolute',
    left: 0,
    top: '22%',
    bottom: '22%',
    width: 4,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
    backgroundColor: COLORS.primary,
  },
  // a white square with a grey quarter-circle on it: the grey row's corner curving away from the white one
  cornerAbove: {
    position: 'absolute',
    right: 0,
    top: -CORNER,
    width: CORNER,
    height: CORNER,
    backgroundColor: COLORS.white,
  },
  cornerBelow: {
    position: 'absolute',
    right: 0,
    bottom: -CORNER,
    width: CORNER,
    height: CORNER,
    backgroundColor: COLORS.white,
  },
  cornerGrey: { flex: 1, backgroundColor: COLORS.mutedBg, borderBottomRightRadius: CORNER },
  cornerGreyBelow: { borderBottomRightRadius: 0, borderTopRightRadius: CORNER },
});

export default CategorySidebar;
