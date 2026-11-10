import { theme as antdTheme } from 'antd';
import { CHROME, DARK, LIGHT, SHAPE } from './tokens';

/**
 * Maps our brand tokens onto Ant Design's token system.
 * `mode` is the resolved mode ('light' | 'dark'), never 'system'.
 */
export function buildTheme(mode) {
  const dark = mode === 'dark';
  const t = dark ? DARK : LIGHT;

  return {
    algorithm: dark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    // Scores of components across this panel read theme colours as
    // `var(--ant-color-*)` (fill tints, semantic backgrounds, accent
    // borders) rather than importing tokens directly. Ant Design only
    // publishes those custom properties when its CSS-variables mode is on —
    // without this, every one of those `var()` calls silently resolves to
    // nothing, which is why large parts of the panel read flatter and more
    // colourless than the token values in this file actually specify.
    cssVar: true,
    hashed: false,
    token: {
      ...SHAPE,
      colorPrimary: t.colorPrimary,
      colorPrimaryHover: t.colorPrimaryHover,
      colorPrimaryActive: t.colorPrimaryActive,
      colorPrimaryBg: t.colorPrimaryBg,
      colorPrimaryBgHover: t.colorPrimaryBgHover,
      colorPrimaryBorder: t.colorPrimaryBorder,
      colorPrimaryBorderHover: t.colorPrimaryBorderHover,
      colorSuccess: t.colorSuccess,
      colorSuccessBg: t.colorSuccessBg,
      colorWarning: t.colorWarning,
      colorWarningBg: t.colorWarningBg,
      colorError: t.colorError,
      colorErrorBg: t.colorErrorBg,
      colorInfo: t.colorInfo,
      colorInfoBg: t.colorInfoBg,
      colorText: t.colorText,
      colorTextSecondary: t.colorTextSecondary,
      colorTextTertiary: t.colorTextTertiary,
      colorTextPlaceholder: t.colorTextPlaceholder,
      colorTextHeading: t.colorText,
      colorTextLightSolid: t.colorTextLightSolid,
      colorBgLayout: t.colorBgLayout,
      colorBgContainer: t.colorBgContainer,
      colorBgElevated: t.colorBgElevated,
      colorBorder: t.colorBorder,
      colorBorderSecondary: t.colorBorderSecondary,
      colorLink: t.colorLink,
      colorLinkHover: t.colorLinkHover,
      controlOutline: t.focusRing,
      boxShadowTertiary: t.shadow,
    },
    components: {
      Layout: {
        headerBg: CHROME.headerBg,
        headerHeight: 64,
        headerPadding: '0 16px',
        bodyBg: t.colorBgLayout,
        siderBg: CHROME.siderBg,
      },
      Menu: {
        darkItemBg: 'transparent',
        darkSubMenuItemBg: 'transparent',
        darkItemColor: CHROME.text,
        darkItemHoverColor: CHROME.textHover,
        darkItemHoverBg: CHROME.itemHoverBg,
        darkItemSelectedBg: CHROME.itemActiveBg,
        darkItemSelectedColor: CHROME.textActive,
        darkGroupTitleColor: CHROME.text,
        itemHeight: 36,
        itemMarginBlock: 2,
        itemMarginInline: 12,
        itemBorderRadius: 8,
        subMenuItemBorderRadius: 8,
        iconSize: 16,
        collapsedIconSize: 16,
        iconMarginInlineEnd: 10,
        fontSize: 13,
        itemSelectedBg: t.colorPrimaryBg,
        itemSelectedColor: t.colorText,
      },
      Table: {
        headerBg: t.tableHeaderBg,
        headerColor: t.colorText,
        headerSplitColor: 'transparent',
        headerBorderRadius: 11,
        rowHoverBg: t.tableRowHoverBg,
        cellFontSize: 13,
        cellPaddingBlock: 12,
        cellPaddingInline: 14,
        borderColor: t.colorBorderSecondary,
        // Money and IDs line up column-wise only with tabular figures.
        fontVariantNumeric: 'tabular-nums',
      },
      // A plain bordered Card otherwise uses `colorBorderSecondary`, which is
      // nearly invisible against the page background — every card on every
      // screen reads noticeably more defined with the stronger border.
      Card: {
        paddingLG: 20,
        bodyPadding: 20,
        headerPadding: 20,
        headerFontSize: 16,
        headerHeight: 56,
        colorBorderSecondary: t.colorBorder,
      },
      Descriptions: { itemPaddingBottom: 12, labelColor: t.colorTextSecondary },
      Tag: { defaultBg: t.colorFillQuaternary },
      Statistic: { contentFontSize: 24 },
      Form: { labelColor: t.colorText, labelFontSize: 13, verticalLabelPadding: '0 0 6px', itemMarginBottom: 20 },
      Select: {
        optionFontSize: 13,
        optionPadding: '8px 12px',
        optionSelectedBg: t.colorPrimaryBg,
        optionSelectedFontWeight: 600,
      },
      Pagination: { itemSize: 32 },
      Input: { activeShadow: `0 0 0 3px ${t.focusRing}`, hoverBorderColor: t.colorPrimaryBorderHover },
      InputNumber: { activeShadow: `0 0 0 3px ${t.focusRing}`, hoverBorderColor: t.colorPrimaryBorderHover },
      DatePicker: { activeShadow: `0 0 0 3px ${t.focusRing}`, hoverBorderColor: t.colorPrimaryBorderHover },
      Tabs: {
        titleFontSize: 13,
        itemColor: t.colorTextSecondary,
        itemHoverColor: t.colorText,
        itemSelectedColor: t.colorText,
        inkBarColor: t.colorPrimary,
        horizontalItemPadding: '10px 0',
        horizontalItemGutter: 28,
      },
      Drawer: { paddingLG: 20 },
      Modal: { paddingContentHorizontalLG: 24, titleFontSize: 16 },
      Segmented: {
        trackBg: t.colorFillQuaternary,
        itemSelectedBg: dark ? '#2E2E2E' : '#FFFFFF',
        itemSelectedColor: t.colorText,
      },
      Button: {
        fontWeight: 500,
        primaryShadow: 'none',
        defaultShadow: 'none',
        dangerShadow: 'none',
      },
      Breadcrumb: { itemColor: t.colorTextSecondary, lastItemColor: t.colorText },
    },
  };
}
