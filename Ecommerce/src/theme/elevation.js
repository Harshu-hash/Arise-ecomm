import { Platform } from 'react-native';

/**
 * Elevation presets. Soft, natural shadows only — never giant blurs.
 * level0 = flat, level1 = cards, level2 = raised cards/headers,
 * level3 = bottom sheets/dialogs, level4 = floating CTAs.
 */
const iosShadow = (offsetY, blurRadius, opacity) => ({
  shadowColor: '#1B222E',
  shadowOffset: { width: 0, height: offsetY },
  shadowRadius: blurRadius,
  shadowOpacity: opacity,
});

export const elevation = {
  level0: Platform.select({ ios: iosShadow(0, 0, 0), android: { elevation: 0 } }),
  level1: Platform.select({ ios: iosShadow(1, 3, 0.06), android: { elevation: 1 } }),
  level2: Platform.select({ ios: iosShadow(2, 6, 0.08), android: { elevation: 3 } }),
  level3: Platform.select({ ios: iosShadow(6, 14, 0.12), android: { elevation: 6 } }),
  level4: Platform.select({ ios: iosShadow(10, 22, 0.16), android: { elevation: 10 } }),
};
