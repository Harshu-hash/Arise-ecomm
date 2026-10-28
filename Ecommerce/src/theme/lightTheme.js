import { palette } from './palette';

/** Light mode semantic tokens. Components read these — never the raw palette. */
export const lightColors = {
  mode: 'light',

  // Brand
  primary: palette.blue500,
  primaryPressed: palette.blue600,
  primarySubtle: palette.blue50,
  onPrimary: palette.white,
  secondary: palette.grey800,
  onSecondary: palette.white,
  accent: palette.amber400,
  accentSubtle: palette.amber100,
  onAccent: palette.grey900,

  // Surfaces
  background: palette.grey50,
  surface: palette.white,
  card: palette.white,
  surfaceVariant: palette.grey100,

  // Content
  textPrimary: palette.grey900,
  textSecondary: palette.grey600,
  textTertiary: palette.grey500,
  textInverse: palette.white,

  // Lines
  border: palette.grey200,
  borderStrong: palette.grey300,

  // Status
  success: palette.green600,
  successSubtle: palette.green100,
  warning: palette.orange600,
  warningSubtle: palette.orange100,
  error: palette.red600,
  errorSubtle: palette.red100,
  info: palette.teal600,
  infoSubtle: palette.teal100,

  // States
  skeleton: palette.grey200,
  skeletonHighlight: palette.grey100,
  disabled: palette.grey300,
  onDisabled: palette.grey500,
  overlay: 'rgba(27, 34, 46, 0.55)',
  ripple: 'rgba(42, 75, 160, 0.12)',

  // Domain
  rating: palette.amber400,
  priceDiscount: palette.green700,
  strikethrough: palette.grey500,
};
