// Required lazily, not imported statically: the library looks up its native module
// at import time, which throws (and would take down this whole module, and anything
// that imports `haptics` from it) on a JS bundle that hasn't been through a native
// rebuild yet. Haptics are best-effort — never let that break a screen.
let ReactNativeHapticFeedback = null;
try {
  ReactNativeHapticFeedback = require('react-native-haptic-feedback').default;
} catch (e) {
  ReactNativeHapticFeedback = null;
}

const options = { enableVibrateFallback: true, ignoreAndroidSystemSettings: false };

const fire = (type) => {
  try {
    ReactNativeHapticFeedback?.trigger(type, options);
  } catch (e) {}
};

export const haptics = {
  light: () => fire('impactLight'), // generic taps, +/- stepper, chip select
  medium: () => fire('impactMedium'), // add to cart, wishlist like, checkout CTA
  selection: () => fire('selection'), // tab switch, OTP digit, toggle
  success: () => fire('notificationSuccess'), // copy code, form submit success
  warning: () => fire('notificationWarning'), // remove item, errors
};
