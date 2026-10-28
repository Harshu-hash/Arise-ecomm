import React, { useEffect } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@theme';

const PULSE_MIN_OPACITY = 0.45;

/**
 * Skeleton block with a soft opacity pulse (no harsh shimmer bands).
 * Compose into feature-specific skeleton layouts, e.g. ProductCardSkeleton.
 */
function Skeleton({ width = '100%', height = 16, borderRadius, circle = false, style }) {
  const { colors, radius, durations } = useTheme();
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(PULSE_MIN_OPACITY, { duration: durations.shimmer }),
      -1,
      true,
    );
  }, [opacity, durations.shimmer]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const resolvedRadius = circle
    ? typeof height === 'number'
      ? height / 2
      : radius.pill
    : borderRadius ?? radius.sm;

  return (
    <Animated.View
      style={[
        {
          width: circle ? height : width,
          height,
          borderRadius: resolvedRadius,
          backgroundColor: colors.skeleton,
        },
        animatedStyle,
        style,
      ]}
    />
  );
}

export default React.memo(Skeleton);
