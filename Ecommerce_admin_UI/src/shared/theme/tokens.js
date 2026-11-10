/**
 * Design tokens for the admin and seller panels.
 *
 * The palette follows the MasterAriseAdmin reference: a neutral zinc scale,
 * near-black primary actions, a dark navigation rail and top bar in both
 * themes, and amber as the single brand accent. Semantic colours (success,
 * warning, error, info) keep their meaning and are tuned to clear WCAG AA.
 */

/** The rail and top bar stay dark in light and dark mode alike. */
export const CHROME = {
  siderBg: '#09090B',
  headerBg: '#000000',
  border: '#27272A',
  text: '#A1A1AA',
  textHover: '#F4F4F5',
  textActive: '#FFFFFF',
  itemHoverBg: '#18181B',
  itemActiveBg: '#27272A',
  accent: '#F59E0B',
};

export const LIGHT = {
  colorPrimary: '#171717',
  colorPrimaryHover: '#404040',
  colorPrimaryActive: '#0A0A0A',
  colorPrimaryBg: '#F5F5F5',
  colorPrimaryBgHover: '#EDEDED',
  colorPrimaryBorder: '#D4D4D4',
  colorPrimaryBorderHover: '#A3A3A3',
  colorSuccess: '#059669',
  colorSuccessBg: '#ECFDF5',
  colorWarning: '#D97706',
  colorWarningBg: '#FFFBEB',
  colorError: '#DC2626',
  colorErrorBg: '#FEF2F2',
  colorInfo: '#2563EB',
  colorInfoBg: '#EFF6FF',
  colorLink: '#2563EB',
  colorLinkHover: '#1D4ED8',
  colorText: '#0A0A0A',
  colorTextSecondary: '#737373',
  colorTextTertiary: '#8A8A8A',
  colorTextPlaceholder: '#8A8A8A',
  colorBgLayout: '#F5F5F5',
  colorBgContainer: '#FFFFFF',
  colorBgElevated: '#FFFFFF',
  colorBorder: '#E5E5E5',
  colorBorderSecondary: '#EDEDED',
  colorFillQuaternary: '#F5F5F5',
  colorTextLightSolid: '#FFFFFF',
  tableHeaderBg: '#FAFAFA',
  tableRowHoverBg: '#FAFAFA',
  focusRing: 'rgba(10,10,10,0.08)',
  shadow: '0 1px 2px rgba(0,0,0,0.04)',
};

export const DARK = {
  colorPrimary: '#E5E5E5',
  colorPrimaryHover: '#F5F5F5',
  colorPrimaryActive: '#D4D4D4',
  colorPrimaryBg: '#262626',
  colorPrimaryBgHover: '#303030',
  colorPrimaryBorder: '#525252',
  colorPrimaryBorderHover: '#737373',
  colorSuccess: '#34D399',
  colorSuccessBg: '#052E22',
  colorWarning: '#FBBF24',
  colorWarningBg: '#2B1D05',
  colorError: '#F87171',
  colorErrorBg: '#2E1213',
  colorInfo: '#60A5FA',
  colorInfoBg: '#10233F',
  colorLink: '#60A5FA',
  colorLinkHover: '#93C5FD',
  colorText: '#FAFAFA',
  colorTextSecondary: '#A3A3A3',
  colorTextTertiary: '#8A8A8A',
  colorTextPlaceholder: '#8A8A8A',
  colorBgLayout: '#0A0A0A',
  colorBgContainer: '#171717',
  colorBgElevated: '#1F1F1F',
  colorBorder: '#2E2E2E',
  colorBorderSecondary: '#262626',
  colorFillQuaternary: '#1F1F1F',
  // Text on a solid primary fill: the primary is near-white in dark mode.
  colorTextLightSolid: '#0A0A0A',
  tableHeaderBg: '#1C1C1C',
  tableRowHoverBg: '#1F1F1F',
  focusRing: 'rgba(250,250,250,0.12)',
  shadow: '0 1px 2px rgba(0,0,0,0.5)',
};

/** Shared, theme-independent shape and type scale. */
export const SHAPE = {
  borderRadius: 8,
  borderRadiusLG: 12,
  borderRadiusSM: 6,
  controlHeight: 36,
  fontFamily:
    "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  fontFamilyCode: "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace",
  fontSize: 14,
  fontSizeSM: 12,
  fontSizeLG: 16,
  fontSizeHeading1: 30,
  fontSizeHeading2: 24,
  fontSizeHeading3: 20,
  fontSizeHeading4: 16,
  sizeUnit: 4,
  wireframe: false,
};

/** 4-pt spacing scale, used by layout components instead of magic numbers. */
export const SPACE = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32 };

export const LAYOUT = {
  siderWidth: 272,
  siderCollapsedWidth: 72,
  headerHeight: 64,
  contentMaxWidth: 1680,
};
