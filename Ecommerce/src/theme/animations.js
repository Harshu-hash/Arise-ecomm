import { Easing } from 'react-native-reanimated';

/**
 * Motion tokens. Subtle by design: animate only presses, transitions,
 * cart/wishlist feedback and loading — never decoration.
 */
export const durations = {
  instant: 100,
  fast: 150,
  normal: 250,
  slow: 400,
  shimmer: 1100,
};

export const easings = {
  standard: Easing.bezier(0.2, 0, 0, 1),
  decelerate: Easing.out(Easing.cubic),
  accelerate: Easing.in(Easing.cubic),
};

/** Reanimated withSpring configs for bounce/pop feedback (hearts, badges, OTP digits). */
export const springs = {
  snappy: { damping: 15, stiffness: 220 },
  bouncy: { damping: 9, stiffness: 180 },
};

/** Scale applied to pressable cards/buttons while pressed. */
export const pressedScale = 0.97;

/** Active opacity for text-like pressables. */
export const pressedOpacity = 0.6;
