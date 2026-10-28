/**
 * Typography scale. Never set fontSize/fontWeight ad hoc in components —
 * always reference one of these variants (usually via <AppText variant="...">).
 * Uses the system font for native feel; swap fontFamily here to rebrand.
 */
export const fontWeights = {
  regular: '400',
  medium: '500',
  semiBold: '600',
  bold: '700',
};

export const typography = {
  headingXl: { fontSize: 28, lineHeight: 34, fontWeight: fontWeights.bold, letterSpacing: -0.4 },
  headingLg: { fontSize: 24, lineHeight: 30, fontWeight: fontWeights.bold, letterSpacing: -0.3 },
  headingMd: { fontSize: 20, lineHeight: 26, fontWeight: fontWeights.semiBold, letterSpacing: -0.2 },
  headingSm: { fontSize: 17, lineHeight: 22, fontWeight: fontWeights.semiBold, letterSpacing: -0.1 },

  bodyLg: { fontSize: 16, lineHeight: 24, fontWeight: fontWeights.regular, letterSpacing: 0 },
  bodyMd: { fontSize: 14, lineHeight: 20, fontWeight: fontWeights.regular, letterSpacing: 0 },
  bodySm: { fontSize: 12, lineHeight: 17, fontWeight: fontWeights.regular, letterSpacing: 0 },

  caption: { fontSize: 11, lineHeight: 14, fontWeight: fontWeights.medium, letterSpacing: 0.2 },
  button: { fontSize: 15, lineHeight: 20, fontWeight: fontWeights.semiBold, letterSpacing: 0.1 },
  label: { fontSize: 13, lineHeight: 18, fontWeight: fontWeights.medium, letterSpacing: 0.1 },

  price: { fontSize: 16, lineHeight: 22, fontWeight: fontWeights.bold, letterSpacing: -0.1 },
  priceLg: { fontSize: 22, lineHeight: 28, fontWeight: fontWeights.bold, letterSpacing: -0.2 },
  offer: { fontSize: 12, lineHeight: 16, fontWeight: fontWeights.semiBold, letterSpacing: 0.2 },
};
