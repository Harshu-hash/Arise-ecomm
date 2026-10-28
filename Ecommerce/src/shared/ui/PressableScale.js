import React, { useCallback } from 'react';
import { Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@theme';
import { haptics } from '../../utils/haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Pressable with the standard press feedback (subtle scale-down + haptic tap).
 * All tappable cards and buttons use this — one press feel everywhere.
 * `haptic`: 'light' | 'medium' | 'selection' | 'success' | 'warning' | false (default 'light').
 * Fired on the completed press, not press-in, so scroll-cancelled touches don't buzz.
 */
function PressableScale({ children, style, disabled, onPress, hitSlop, haptic = 'light', ...rest }) {
  const { pressedScale, durations, easings } = useTheme();
  const scale = useSharedValue(1);

  const handlePressIn = useCallback(() => {
    scale.value = withTiming(pressedScale, {
      duration: durations.instant,
      easing: easings.standard,
    });
  }, [scale, pressedScale, durations.instant, easings.standard]);

  const handlePressOut = useCallback(() => {
    scale.value = withTiming(1, {
      duration: durations.fast,
      easing: easings.standard,
    });
  }, [scale, durations.fast, easings.standard]);

  const handlePress = useCallback(
    (e) => {
      if (haptic) haptics[haptic]?.();
      onPress?.(e);
    },
    [onPress, haptic],
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      hitSlop={hitSlop}
      style={[animatedStyle, style]}
      {...rest}>
      {children}
    </AnimatedPressable>
  );
}

export default React.memo(PressableScale);
