import { useThemeStore } from '@theme/themeStore';

/**
 * A categorical palette that stays legible in both light and dark themes.
 * The first colour is the app's primary blue, so single-series charts match
 * the rest of the product.
 */
export const CHART_COLORS = [
  '#2874F0',
  '#26A541',
  '#FFA41C',
  '#8B5CF6',
  '#FF4D4F',
  '#14B8A6',
  '#EC4899',
  '#64748B',
  '#F97316',
  '#0EA5E9',
];

export function colorAt(i) {
  return CHART_COLORS[i % CHART_COLORS.length];
}

/** Axis/grid/tooltip colours resolved against the active theme. */
export function useChartTheme() {
  const dark = useThemeStore((s) => s.resolved) === 'dark';
  return {
    dark,
    axis: dark ? '#A0A4AB' : '#6B6B6B',
    grid: dark ? '#2A2E36' : '#EFEFEF',
    tooltipBg: dark ? '#1F232B' : '#ffffff',
    tooltipStyle: {
      background: dark ? '#1F232B' : '#ffffff',
      border: `1px solid ${dark ? '#2A2E36' : '#EFEFEF'}`,
      borderRadius: 8,
      fontSize: 12,
    },
  };
}
