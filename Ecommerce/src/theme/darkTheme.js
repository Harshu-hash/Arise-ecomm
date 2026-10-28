import { palette } from './palette';

/** Dark mode semantic tokens. Mirrors lightColors key-for-key. */
export const darkColors = {
  mode: 'dark',

  // Brand — lightened for contrast on dark surfaces.
  primary: palette.blue400,
  primaryPressed: palette.blue200,
  primarySubtle: 'rgba(92, 124, 201, 0.16)',
  onPrimary: palette.navy950,
  secondary: palette.grey200,
  onSecondary: palette.grey900,
  accent: palette.amber300,
  accentSubtle: 'rgba(249, 176, 35, 0.16)',
  onAccent: palette.navy950,

  // Surfaces
  background: palette.navy950,
  surface: palette.navy900,
  card: palette.navy800,
  surfaceVariant: palette.navy700,

  // Content
  textPrimary: palette.grey100,
  textSecondary: palette.grey400,
  textTertiary: palette.grey500,
  textInverse: palette.grey900,

  // Lines
  border: palette.navy700,
  borderStrong: '#33405280',

  // Status
  success: '#5BB974',
  successSubtle: 'rgba(30, 142, 62, 0.18)',
  warning: '#F5923E',
  warningSubtle: 'rgba(232, 113, 10, 0.18)',
  error: '#F28B82',
  errorSubtle: 'rgba(217, 48, 37, 0.18)',
  info: '#4FB3BF',
  infoSubtle: 'rgba(18, 128, 140, 0.18)',

  // States
  skeleton: palette.navy700,
  skeletonHighlight: palette.navy800,
  disabled: palette.navy700,
  onDisabled: palette.grey500,
  overlay: 'rgba(0, 0, 0, 0.65)',
  ripple: 'rgba(92, 124, 201, 0.20)',

  // Domain
  rating: palette.amber300,
  priceDiscount: '#5BB974',
  strikethrough: palette.grey500,
};
