/**
 * Spacing scale (4pt grid). Never use random margins/paddings —
 * every space in the app must come from this scale.
 */
export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
  huge: 48,
  massive: 64,
};

/** Standard horizontal padding for screens. */
export const screenPadding = spacing.md;

/** Minimum touch target size (accessibility). */
export const touchTarget = 44;
