/**
 * Raw color palette. Only theme files (lightTheme/darkTheme) may import this.
 * Feature and shared code must use semantic tokens from useTheme().
 */
export const palette = {
  // Brand — deep, desaturated blue: trustworthy, premium, not "AI neon".
  blue50: '#EEF2FB',
  blue100: '#D7E0F5',
  blue200: '#AFC1EA',
  blue400: '#5C7CC9',
  blue500: '#2A4BA0',
  blue600: '#22409A',
  blue700: '#153075',
  blue900: '#0F1F4B',

  // Accent — warm amber, reserved for offers, ratings and highlights.
  amber100: '#FFF3D3',
  amber300: '#FFC94A',
  amber400: '#F9B023',
  amber500: '#E89C00',

  // Neutrals — cool grey ramp used for text, borders and surfaces.
  white: '#FFFFFF',
  grey50: '#F8F9FB',
  grey100: '#F1F3F6',
  grey200: '#E7EAEF',
  grey300: '#D5DAE2',
  grey400: '#A9B4C0',
  grey500: '#8891A5',
  grey600: '#606D80',
  grey700: '#3E4C63',
  grey800: '#2A3446',
  grey900: '#1B222E',
  black: '#000000',

  // Dark-mode surfaces.
  navy950: '#10141B',
  navy900: '#161C26',
  navy800: '#1E2633',
  navy700: '#273140',

  // Status colors — muted, professional versions.
  green100: '#E6F4EA',
  green600: '#1E8E3E',
  green700: '#188038',
  red100: '#FCE8E6',
  red500: '#E4573D',
  red600: '#D93025',
  orange100: '#FEF0E6',
  orange600: '#E8710A',
  teal100: '#E4F3F5',
  teal600: '#12808C',
};
