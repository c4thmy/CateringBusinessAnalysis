/**
 * 设计常量唯一来源：颜色、字号、间距、圆角、语义色。
 * 视觉基准：docs/webUI.md（深色藏青侧边导航 / 白色顶栏 / 浅灰内容区 / 白卡片 / 主色 #2F54EB）。
 * 所有页面与组件只从这里取色与间距，禁止页面内写死颜色。
 */
import type { ThemeConfig } from 'antd'

export const color = {
  /** 品牌主色 */
  primary: '#2F54EB',
  primaryHover: '#1D39C4',
  primarySoft: '#E8ECFD',

  /** 侧边导航（深色藏青） */
  siderBg: '#0F1A3C',
  siderBgDeep: '#0B1430',
  siderText: '#AEB8D6',
  siderTextStrong: '#FFFFFF',
  siderDivider: 'rgba(255,255,255,0.10)',

  /** 框架 */
  headerBg: '#FFFFFF',
  pageBg: '#F5F6FA',
  cardBg: '#FFFFFF',
  border: '#EDEFF5',
  divider: '#F0F2F7',

  /** 文字分层 */
  text: '#1F2430',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',

  /** 语义色：正向（绿）/ 负向（红），除颜色外还必须带 ↑/↓ 与正负号 */
  positive: '#389E0D',
  negative: '#CF1322',
  neutral: '#6B7280',
  positiveBar: '#52C41A',
  negativeBar: '#FF4D4F',

  /** 图表 */
  chartBlue: '#2F54EB',
  chartLightBlue: '#7C93F5',
  chartGrid: '#EEF0F5',
  chartOrange: '#FA8C16',
  chartGray: '#BFBFBF',
  /** 对比值柱（同期） */
  chartComparison: '#BFC8E8',

  /** 状态 */
  warning: '#D46B08',
  success: '#389E0D',
  info: '#1677FF',
} as const

export const radius = {
  /** 卡片圆角：小圆角、工具型观感 */
  card: 6,
  control: 6,
  pill: 999,
} as const

export const fontSize = {
  kpiValue: 30,
  kpiUnit: 13,
  cardTitle: 15,
  body: 14,
  small: 12,
  footnote: 12,
} as const

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const

export const layout = {
  siderWidth: 236,
  headerHeight: 64,
  contentPadding: 16,
  cardGap: 16,
} as const

/** Ant Design 主题：所有 antd 组件从这里继承设计常量 */
export const antdTheme: ThemeConfig = {
  token: {
    colorPrimary: color.primary,
    colorLink: color.primary,
    colorSuccess: color.positive,
    colorError: color.negative,
    colorWarning: color.warning,
    colorText: color.text,
    colorTextSecondary: color.textSecondary,
    colorTextTertiary: color.textTertiary,
    colorBorder: color.border,
    colorBorderSecondary: color.divider,
    colorBgLayout: color.pageBg,
    colorBgContainer: color.cardBg,
    borderRadius: radius.card,
    borderRadiusLG: radius.card,
    fontSize: fontSize.body,
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif',
    boxShadowTertiary: '0 1px 2px rgba(16, 24, 40, 0.04)',
  },
  components: {
    Layout: {
      siderBg: color.siderBg,
      headerBg: color.headerBg,
      bodyBg: color.pageBg,
      headerPadding: '0 20px',
      headerHeight: layout.headerHeight,
    },
    Menu: {
      darkItemBg: color.siderBg,
      darkSubMenuItemBg: color.siderBgDeep,
      darkItemColor: color.siderText,
      darkItemHoverBg: 'rgba(47, 84, 235, 0.18)',
      darkItemSelectedBg: color.primary,
      darkItemSelectedColor: color.siderTextStrong,
      itemBorderRadius: radius.control,
      itemMarginInline: 8,
      itemHeight: 40,
    },
    Card: {
      paddingLG: space.lg,
      headerFontSize: fontSize.cardTitle,
      colorBorderSecondary: color.border,
    },
    Table: {
      headerBg: '#F7F8FC',
      headerColor: color.textSecondary,
      headerSplitColor: color.border,
      rowHoverBg: '#F5F7FF',
      borderColor: color.divider,
      cellPaddingBlockSM: 8,
      cellPaddingInlineSM: 10,
    },
    Segmented: {
      itemSelectedBg: color.primarySoft,
      itemSelectedColor: color.primary,
    },
    Button: {
      primaryShadow: 'none',
      defaultShadow: 'none',
    },
    Statistic: {
      contentFontSize: 28,
    },
  },
}
