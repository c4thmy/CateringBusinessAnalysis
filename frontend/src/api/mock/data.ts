/**
 * 一期 mock 数据（VITE_API_MODE=mock）。
 * 数字来源（禁止自造）：
 * - openspec/changes/build-catering-analysis-platform/design.md 第 14 节验收数字；
 * - shared/api-contract.md 的 JSON 形状与示例值；
 * - docs/research/excel-sample-data.json（Excel 明细提取：13 店收入、同店客流/客单、渠道、系列量价、时段客流、漏斗、ROI）；
 * - docs/domain/data-caliber-notes.md（四套收入合计口径与尾差）。
 * 其中「经营模式」维度示例数据未提供，为演示占位分摊（合计等于门店口径），页面已注明。
 */
import type {
  ApiEnvelope,
  BridgeItem,
  ChannelData,
  ChannelDetailData,
  ConclusionData,
  DataStatusData,
  DatasetReadiness,
  DaypartRow,
  ImportBatch,
  ImportTemplate,
  Insight,
  OverviewData,
  ProductData,
  ProfitData,
  ProfitRow,
  SameStoreData,
  SeriesRow,
  StoreDetailData,
  StoreRow,
  StructureData,
  StructureDimension,
} from '../types'

const r2 = (value: number) => Math.round(value * 100) / 100
const r4 = (value: number) => Math.round(value * 10000) / 10000

/* ------------------------------------------------------------------ */
/* 洞察（规则化，来自 design.md 第 15 节规则）                          */
/* ------------------------------------------------------------------ */

export const insights: Record<string, Insight[]> = {
  overview: [
    {
      level: 'positive',
      title: '收入规模是最主要正向因素',
      text: '营业收入增加 240.00 万元（+31.6%），按基期边际贡献率 41.87% 贡献营业利润 100.48 万元，占利润增量 48.10 万元的 208.9%。',
      evidence: '利润桥·收入规模',
    },
    {
      level: 'negative',
      title: '固定费用是最大拖累',
      text: '其它费用增加 37.00 万元、店铺房租增加 13.76 万元、工资奖金增加 12.03 万元，合计拖累营业利润 62.79 万元。',
      evidence: '利润桥·其它费用 / 店铺房租 / 工资奖金',
    },
    {
      level: 'info',
      title: '食材成本率上升被优惠率下降部分对冲',
      text: '食材成本率 25.66% → 26.70%（+1.04pp，影响 -10.42 万元），优惠及手续费率 24.79% → 23.50%（-1.29pp，影响 +12.93 万元）。',
      evidence: '利润桥·食材成本率 / 优惠及手续费',
    },
  ],
  profit: [
    {
      level: 'positive',
      title: '收入规模 +100.48 万元',
      text: '收入同比增长 240.00 万元，按基期边际贡献率 41.87% 贡献利润 100.48 万元，是利润增长的第一驱动。',
      evidence: '利润桥·收入规模',
    },
    {
      level: 'negative',
      title: '其它费用 +37.00 万元',
      text: '其它费用从 47.00 万元增至 84.00 万元（+78.7%），是利润桥最大负向因素；其次是店铺房租 -13.76、工资奖金 -12.03。',
      evidence: '利润桥·其它费用',
    },
    {
      level: 'info',
      title: '变动成本率合计小幅优化',
      text: '食材成本率 +1.04pp，但优惠及手续费 -1.29pp、水电气低值 -0.22pp、宣传费用 -0.74pp，四项变动成本率合计下降 1.20pp，贡献 +12.05 万元。',
      evidence: '利润桥·变动成本四项',
    },
  ],
  structure: [
    {
      level: 'positive',
      title: '美团大众增长贡献最大',
      text: '美团大众本期 460.00 万元、同期 336.00 万元，增加 124.00 万元（+36.9%），占渠道口径收入增量的 51.6%。',
      evidence: '收入结构·渠道',
    },
    {
      level: 'positive',
      title: '扫码支付与抖音次之',
      text: '扫码支付 +64.00 万元（+25.4%）、抖音 +13.00 万元（+433.3%），是第二、第三增长来源。',
      evidence: '收入结构·渠道',
    },
    {
      level: 'negative',
      title: '招商银行是唯一明显下降渠道',
      text: '招商银行 3.50 → 3.00 万元（-0.50 万元，-14.3%）；饿了外卖同店口径 -0.12 万元、堂食现金 -0.43 万元。',
      evidence: '收入结构·渠道',
    },
  ],
  same_store: [
    {
      level: 'info',
      title: '同店增长由客流主导',
      text: '同店收入 +97.28 万元中，客流影响 +92.07 万元（占 94.8%）、客单影响 +5.08 万元（占 5.2%）；客流 +12.17%、客单 +0.55%，增长质量来自客流而非提价。',
      evidence: '同店异动·客流×客单',
    },
    {
      level: 'negative',
      title: '门店12 收入与客流双降',
      text: '门店12 收入 59.23 → 56.10 万元（-3.13 万元，-5.3%），客流 4,556.15 → 4,276.24 人次（-280，-6.1%），是 13 家同店中唯一双降门店。',
      evidence: '同店异动·门店明细',
    },
    {
      level: 'info',
      title: '两项影响合计与收入差额 0.12 万元',
      text: '客流影响 + 客单影响 = 97.16 万元，同店收入变动 97.28 万元，相差 0.12 万元为源表取整尾差，不影响「客流主导」的判断。',
      evidence: '同店异动·尾差说明',
    },
  ],
  store12: [
    {
      level: 'negative',
      title: '工作日客流是主要拖累',
      text: '工作日客流 2,850 → 2,385 人次（-465，-16.3%），其中 14:00-24:00 -305 人次、9:00-14:00 -156 人次；节假日 +185 人次（+10.8%）无法对冲。',
      evidence: '门店12·时段客流',
    },
    {
      level: 'negative',
      title: '客流下降主导收入减少',
      text: '客流影响 -3.64 万元、客单影响 +0.51 万元，合计 -3.13 万元；客单价 130.00 → 131.19 元（+0.9%）基本稳定。',
      evidence: '门店12·三项对比',
    },
  ],
  channel: [
    {
      level: 'positive',
      title: '美团大众同店 +58.24 万元',
      text: '美团大众本期 460.00 万元，其中同店 394.23 万元、新店分摊 65.77 万元；同店同比 +58.24 万元（+17.3%）。',
      evidence: '渠道下钻·同店渠道异动',
    },
    {
      level: 'info',
      title: '渠道大类：堂食占比 90.7%',
      text: '堂食 906.58 万元（+221.58，+32.3%）、外卖 93.42 万元（+18.86，+25.3%）；堂食包含团购到店核销，不等于线下现金。',
      evidence: '渠道下钻·渠道大类',
    },
    {
      level: 'info',
      title: '新店分摊采用本期渠道占比',
      text: '新店分摊 = 渠道本期收入 ×（143.00 ÷ 1000.00）；Excel 另有一版按同期占比分摊（美团大众同店 396.74 / 新店 63.26），两版差 0.20 万元，页面已注明。',
      evidence: '渠道下钻·分摊口径',
    },
  ],
  channelDetail: [
    {
      level: 'negative',
      title: '访问-支付转化率环比下降 1.2pp',
      text: '访问 639,025 → 支付 73,113，转化率 11.44%，环比下降 1.2pp（超过 1pp 阈值），是漏斗中最需要关注的环节。',
      evidence: '渠道详情·漏斗·访问-支付',
    },
    {
      level: 'negative',
      title: '平台费用率 30.0% 超阈值',
      text: '平台费用 138.00 万元 / 平台收入 460.00 万元 = 30.0%，高于 ≤15.0% 的阈值；毛利 ROI 2.00（≥1.0 达标），销售 ROI 3.33（<4.0 未达标）。',
      evidence: '渠道详情·平台费用率 / ROI',
    },
    {
      level: 'info',
      title: '品牌新客占比 86.15%',
      text: '品牌顾客 69,298 人，其中新客 59,703 人（86.15%）、老客 9,595 人；拉新效率高但老客复购空间大。',
      evidence: '渠道详情·漏斗·顾客结构',
    },
  ],
  product: [
    {
      level: 'positive',
      title: '销量增长贡献 +91.50 万元',
      text: '同店系列量价：销量影响 +91.50 万元、单价影响 +5.67 万元，合计 +97.17 万元；肉类、涮品类、小料类是主要增长系列。',
      evidence: '产品下钻·系列量价',
    },
    {
      level: 'negative',
      title: '主食类降价换量',
      text: '主食类销量 27,658 → 32,330.71，销量影响 +12.84 万元；单价 27.48 → 12.14 元，单价影响 -49.58 万元，合计 -36.74 万元。',
      evidence: '产品下钻·系列量价·主食类',
    },
    {
      level: 'info',
      title: '套餐增收来自量增价降',
      text: '套餐订单 432 → 5,472 单，量差 +770,933.33 元；实收单价 152.96 → 81.18 元，价差 -392,795.79 元；合计 +378,137.54 元。',
      evidence: '产品下钻·套餐量价',
    },
  ],
  conclusion: [
    {
      level: 'info',
      title: '收入增长 240.28 万元由新店与同店客流共同驱动',
      text: '新店 +143.00 万元、同店客流 +92.07 万元、同店客单 +5.08 万元，四项合计 240.15 万元，与收入变动 240.28 万元差 0.13 万元为源表取整尾差。',
      evidence: '结论与计划·异动汇总',
    },
    {
      level: 'negative',
      title: '门店12 工作日常规时段需要专项复盘',
      text: '门店12 是唯一收入与客流双降门店，工作日 9:00-14:00 与 14:00-24:00 合计 -461 人次，建议列入下月整改清单。',
      evidence: '结论与计划·门店12',
    },
  ],
}

/* ------------------------------------------------------------------ */
/* 经营总览                                                           */
/* ------------------------------------------------------------------ */

const monthBridgeItems: BridgeItem[] = [
  {
    key: 'revenue_scale',
    name: '收入规模',
    impact: 100.48,
    kind: 'positive',
    note: '收入增长 240.00 万 × 基期边际贡献率 41.87%',
  },
  {
    key: 'food_cost_rate',
    name: '食材成本率',
    impact: -10.42,
    kind: 'negative',
    note: '食材成本率 26.70% ← 25.66%（+1.04pp）',
  },
  {
    key: 'discount_fee_rate',
    name: '优惠及手续费',
    impact: 12.93,
    kind: 'positive',
    note: '优惠及手续费率 23.50% ← 24.79%（-1.29pp）',
  },
  {
    key: 'utilities_rate',
    name: '水电气低值',
    impact: 2.17,
    kind: 'positive',
    note: '水电气低值率 3.99% ← 4.21%（-0.22pp）',
  },
  {
    key: 'marketing_rate',
    name: '宣传费用',
    impact: 7.39,
    kind: 'positive',
    note: '宣传费用率 2.74% ← 3.47%（-0.74pp）',
  },
  {
    key: 'salary',
    name: '工资奖金',
    impact: -12.03,
    kind: 'negative',
    note: '工资奖金 147.03 万 ← 135.00 万（+8.9%）',
  },
  {
    key: 'dorm_rent',
    name: '宿舍房租',
    impact: -1.66,
    kind: 'negative',
    note: '宿舍房租 17.16 万 ← 15.50 万（+10.7%）',
  },
  {
    key: 'store_rent',
    name: '店铺房租',
    impact: -13.76,
    kind: 'negative',
    note: '店铺房租 69.86 万 ← 56.10 万（+24.5%）',
  },
  {
    key: 'other_expense',
    name: '其它费用',
    impact: -37.0,
    kind: 'negative',
    note: '其它费用 84.00 万 ← 47.00 万（+78.7%）',
  },
]

const ytdBridgeItems: BridgeItem[] = [
  {
    key: 'revenue_scale',
    name: '收入规模',
    impact: 1665.0,
    kind: 'positive',
    note: '累计收入增长 3,930.00 万 × 基期边际贡献率 42.37%',
  },
  {
    key: 'food_cost_rate',
    name: '食材成本率',
    impact: -211.24,
    kind: 'negative',
    note: '食材成本率 27.80% ← 25.16%（+2.64pp）',
  },
  {
    key: 'discount_fee_rate',
    name: '优惠及手续费',
    impact: 103.35,
    kind: 'positive',
    note: '优惠及手续费率 23.50% ← 24.79%（-1.29pp）',
  },
  {
    key: 'utilities_rate',
    name: '水电气低值',
    impact: 17.3,
    kind: 'positive',
    note: '水电气低值率 3.99% ← 4.21%（-0.22pp）',
  },
  {
    key: 'marketing_rate',
    name: '宣传费用',
    impact: 59.02,
    kind: 'positive',
    note: '宣传费用率 2.74% ← 3.47%（-0.74pp）',
  },
  {
    key: 'salary',
    name: '工资奖金',
    impact: -453.59,
    kind: 'negative',
    note: '工资奖金 1,174.77 万 ← 721.18 万（+62.9%）',
  },
  {
    key: 'dorm_rent',
    name: '宿舍房租',
    impact: -54.31,
    kind: 'negative',
    note: '宿舍房租 137.11 万 ← 82.80 万（+65.6%）',
  },
  {
    key: 'store_rent',
    name: '店铺房租',
    impact: -258.49,
    kind: 'negative',
    note: '店铺房租 558.18 万 ← 299.69 万（+86.3%）',
  },
  {
    key: 'other_expense',
    name: '其它费用',
    impact: -420.08,
    kind: 'negative',
    note: '其它费用 671.16 万 ← 251.08 万（+167.3%）',
  },
]

export const overviewMonth: OverviewData = {
  kpis: {
    revenue: { value: 1000.0, base: 760.0, diff: 240.0, rate: 0.315789, unit: '万元' },
    profit: { value: 112.7, base: 64.6, diff: 48.1, rate: 0.744598, unit: '万元' },
    gross_margin: { value: 0.733, base: 0.7434, diff: -0.0104, rate: null, unit: 'pp' },
    same_store_growth: { value: 0.128008, base: null, diff: null, rate: null, unit: '%' },
  },
  profit_bridge: { start: 64.6, end: 112.7, items: monthBridgeItems },
  percentiles: {
    gross_margin: { p25: 0.71, p50: 0.73, p75: 0.75, current: 0.733, bucket: 'P50–P75' },
    revenue: { p25: 54.5, p50: 62.39, p75: 77.0, current: null, bucket: null },
    same_store_growth: { p25: 0.079, p50: 0.1018, p75: 0.1914, current: 0.128, bucket: 'P50–P75' },
  },
  percentile_hints: {
    profit: '门店级营业利润明细未导入，暂不展示分位（二期随预算/门店利润表开放）',
  },
  summary:
    '2025-09 营业收入 1,000.00 万元（同比 +240.00 万元，+31.6%），营业利润 112.70 万元（同比 +48.10 万元，+74.5%）；利润增长主要来自收入规模 +100.48 万元，最大拖累为其它费用 -37.00 万元、店铺房租 -13.76 万元。',
  note: '总览使用利润表口径（2024-09 760.00 万 → 2025-09 1000.00 万）；其它口径见页面脚注。',
}

export const overviewYtd: OverviewData = {
  kpis: {
    revenue: { value: 7990.0, base: 4060.0, diff: 3930.0, rate: 0.96798, unit: '万元' },
    profit: { value: 812.29, base: 365.32, diff: 446.97, rate: 1.22351, unit: '万元' },
    gross_margin: { value: 0.721963, base: 0.748401, diff: -0.026438, rate: null, unit: 'pp' },
    same_store_growth: { value: null, base: null, diff: null, rate: null, unit: '%' },
  },
  profit_bridge: { start: 365.32, end: 812.29, items: ytdBridgeItems },
  percentiles: {},
  percentile_hints: {
    revenue: '累计口径未提供门店级分布，暂不展示分位',
    profit: '累计口径未提供门店级分布，暂不展示分位',
    gross_margin: '累计口径未提供门店级分布，暂不展示分位',
    same_store_growth: '累计同店口径未提供数据',
  },
  summary:
    '2025-01~09 累计营业收入 7,990.00 万元（同比 +3,930.00 万元，+96.8%），累计营业利润 812.29 万元（同比 +446.97 万元，+122.4%）；最大正向为收入规模 +1,665.00 万元，最大拖累为其它费用 -420.08 万元、工资奖金 -453.59 万元。',
  note: '累计口径为 2025-01~09 vs 2024-01~09（Excel「当月和累计数据对比分析」）。',
}

/* ------------------------------------------------------------------ */
/* 营业利润                                                           */
/* ------------------------------------------------------------------ */

const profitMonthRows: ProfitRow[] = [
  {
    account: '营业收入',
    current: 1000,
    current_ratio: 1,
    base: 760,
    base_ratio: 1,
    diff: 240,
    rate: 0.315789,
    ratio_pp: 0,
    kind: 'revenue',
  },
  {
    account: '毛利额',
    current: 733,
    current_ratio: 0.733,
    base: 565,
    base_ratio: 0.743421,
    diff: 168,
    rate: 0.297345,
    ratio_pp: -0.010421,
    is_subtotal: true,
    kind: 'subtotal',
  },
  {
    account: '食材成本',
    current: 267,
    current_ratio: 0.267,
    base: 195,
    base_ratio: 0.256579,
    diff: 72,
    rate: 0.369231,
    ratio_pp: 0.010421,
    kind: 'cost',
  },
  {
    account: '优惠及手续费',
    current: 234.96,
    current_ratio: 0.23496,
    base: 188.4,
    base_ratio: 0.247895,
    diff: 46.56,
    rate: 0.247134,
    ratio_pp: -0.012935,
    kind: 'cost',
  },
  {
    account: '水电气低值',
    current: 39.94,
    current_ratio: 0.03994,
    base: 32,
    base_ratio: 0.042105,
    diff: 7.94,
    rate: 0.248125,
    ratio_pp: -0.002165,
    kind: 'cost',
  },
  {
    account: '宣传费用',
    current: 27.35,
    current_ratio: 0.02735,
    base: 26.4,
    base_ratio: 0.034737,
    diff: 0.95,
    rate: 0.035985,
    ratio_pp: -0.007387,
    kind: 'cost',
  },
  {
    account: '工资奖金',
    current: 147.03,
    current_ratio: 0.14703,
    base: 135,
    base_ratio: 0.177632,
    diff: 12.03,
    rate: 0.089111,
    ratio_pp: -0.030602,
    kind: 'cost',
  },
  {
    account: '宿舍房租',
    current: 17.16,
    current_ratio: 0.01716,
    base: 15.5,
    base_ratio: 0.020395,
    diff: 1.66,
    rate: 0.107097,
    ratio_pp: -0.003235,
    kind: 'cost',
  },
  {
    account: '店铺房租',
    current: 69.86,
    current_ratio: 0.06986,
    base: 56.1,
    base_ratio: 0.073816,
    diff: 13.76,
    rate: 0.245276,
    ratio_pp: -0.003956,
    kind: 'cost',
  },
  {
    account: '其它费用',
    current: 84,
    current_ratio: 0.084,
    base: 47,
    base_ratio: 0.061842,
    diff: 37,
    rate: 0.787234,
    ratio_pp: 0.022158,
    kind: 'cost',
  },
  {
    account: '营业利润',
    current: 112.7,
    current_ratio: 0.1127,
    base: 64.6,
    base_ratio: 0.085,
    diff: 48.1,
    rate: 0.744598,
    ratio_pp: 0.0277,
    is_total: true,
    kind: 'profit',
  },
]

const ytdBase: Record<string, [number, number]> = {
  营业收入: [7990, 4060],
  食材成本: [2221.52, 1021.49],
  优惠及手续费: [1877.33, 1006.45],
  水电气低值: [319.12, 170.95],
  宣传费用: [218.53, 141.03],
  工资奖金: [1174.77, 721.18],
  宿舍房租: [137.11, 82.8],
  店铺房租: [558.18, 299.69],
  其它费用: [671.16, 251.08],
}

function ytdRow(account: string, kind: ProfitRow['kind']): ProfitRow {
  const [current, base] = ytdBase[account]
  const currentRatio = account === '营业收入' ? 1 : current / 7990
  const baseRatio = account === '营业收入' ? 1 : base / 4060
  return {
    account,
    current,
    current_ratio: r4(currentRatio),
    base,
    base_ratio: r4(baseRatio),
    diff: r2(current - base),
    rate: r4((current - base) / base),
    ratio_pp: r4(currentRatio - baseRatio),
    kind,
  }
}

const profitYtdRows: ProfitRow[] = [
  ytdRow('营业收入', 'revenue'),
  {
    account: '毛利额',
    current: 5768.48,
    current_ratio: 0.721963,
    base: 3038.51,
    base_ratio: 0.748401,
    diff: 2729.97,
    rate: 0.898461,
    ratio_pp: -0.026438,
    is_subtotal: true,
    kind: 'subtotal',
  },
  ytdRow('食材成本', 'cost'),
  ytdRow('优惠及手续费', 'cost'),
  ytdRow('水电气低值', 'cost'),
  ytdRow('宣传费用', 'cost'),
  ytdRow('工资奖金', 'cost'),
  ytdRow('宿舍房租', 'cost'),
  ytdRow('店铺房租', 'cost'),
  ytdRow('其它费用', 'cost'),
  {
    account: '营业利润',
    current: 812.29,
    current_ratio: 0.101663,
    base: 365.32,
    base_ratio: 0.08998,
    diff: 446.97,
    rate: 1.22351,
    ratio_pp: 0.011683,
    is_total: true,
    kind: 'profit',
  },
]

export const profitMonth: ProfitData = {
  rows: profitMonthRows,
  profit: { current: 112.7, base: 64.6, diff: 48.1 },
  profit_bridge: { start: 64.6, end: 112.7, items: monthBridgeItems },
  budget: null,
  mode: 'month',
  note: '利润表口径（Excel「2025年月利润表数据」L/Z 列）；毛利额 = 营业收入 − 食材成本。',
}

export const profitYtd: ProfitData = {
  rows: profitYtdRows,
  profit: { current: 812.29, base: 365.32, diff: 446.97 },
  profit_bridge: { start: 365.32, end: 812.29, items: ytdBridgeItems },
  budget: null,
  mode: 'ytd',
  note: '累计口径为 2025-01~09 vs 2024-01~09（Excel「当月和累计数据对比分析」）。',
}

/* ------------------------------------------------------------------ */
/* 收入结构                                                           */
/* ------------------------------------------------------------------ */

interface StructureSourceRow {
  key: string
  name: string
  current: number
  base: number
}

function buildStructure(
  dimension: StructureDimension,
  dimensionName: string,
  totalCurrent: number,
  totalBase: number,
  rows: StructureSourceRow[],
  caliberNote: string,
): StructureData {
  const built = rows.map((row) => ({
    ...row,
    current_share: totalCurrent ? r4(row.current / totalCurrent) : null,
    base_share: totalBase ? r4(row.base / totalBase) : null,
    diff: r2(row.current - row.base),
    rate: row.base ? r4((row.current - row.base) / row.base) : null,
  }))
  return {
    dimension,
    dimension_name: dimensionName,
    total: {
      current: totalCurrent,
      base: totalBase,
      diff: r2(totalCurrent - totalBase),
      rate: totalBase ? r4((totalCurrent - totalBase) / totalBase) : null,
    },
    rows: built,
    caliber_note: caliberNote,
  }
}

const channelSource: StructureSourceRow[] = [
  { key: 'meituan_dazhong', name: '美团大众', current: 460, base: 336 },
  { key: 'scan_pay', name: '扫码支付', current: 316, base: 252 },
  { key: 'online_promo', name: '线上活动优惠', current: 101, base: 82 },
  { key: 'meituan_waimai', name: '美团外卖', current: 60, base: 46 },
  { key: 'eleme_waimai', name: '饿了外卖', current: 32, base: 27.55 },
  { key: 'douyin', name: '抖音', current: 16, base: 3 },
  { key: 'member_stored', name: '会员储值消费', current: 7, base: 5 },
  { key: 'dine_in_cash', name: '堂食现金', current: 3.58, base: 3.5 },
  { key: 'cmb', name: '招商银行', current: 3, base: 3.5 },
  { key: 'jd_waimai', name: '京东外卖', current: 1.42, base: 1.01 },
]

const seriesSource: StructureSourceRow[] = [
  { key: 'meat', name: '肉类', current: 546.07, base: 388 },
  { key: 'soup_base', name: '锅底类', current: 62.09, base: 53 },
  { key: 'hotpot', name: '涮品类', current: 210.86, base: 141 },
  { key: 'staple', name: '主食类', current: 45.81, base: 76 },
  { key: 'cold', name: '凉菜类', current: 8.17, base: 15 },
  { key: 'condiment', name: '小料类', current: 77.16, base: 38 },
  { key: 'drink', name: '饮品', current: 49, base: 43 },
  { key: 'other', name: '其它', current: 1, base: 6 },
]

export const structures: Record<StructureDimension, StructureData> = {
  business_model: buildStructure(
    'business_model',
    '经营模式',
    1000.23,
    759.95,
    [
      { key: 'direct', name: '直营', current: 640.23, base: 480 },
      { key: 'franchise', name: '加盟', current: 240, base: 180 },
      { key: 'joint', name: '联营', current: 120, base: 99.95 },
    ],
    '经营模式为门店维度字段；示例数据未提供该字段，当前为演示占位分摊（合计等于门店口径 1000.23 / 759.95），接入门店维度后以导入数据为准。',
  ),
  store_type: buildStructure(
    'store_type',
    '在营门店类型',
    1000.23,
    759.95,
    [
      { key: 'same', name: '同店（13 家）', current: 857.23, base: 759.95 },
      { key: 'new', name: '新店（2 家）', current: 143, base: 0 },
      { key: 'closed', name: '闭店', current: 0, base: 0 },
    ],
    '同店 = 对比期已开业且有收入的门店（13 家）；新店 = 对比期无收入的门店（2 家）；闭店 0 家。合计为门店口径 1000.23 / 759.95。',
  ),
  region: buildStructure(
    'region',
    '区域',
    1000.23,
    759.95,
    [
      { key: 'region_1', name: '区域一', current: 369.76, base: 321 },
      { key: 'region_2', name: '区域二', current: 312.29, base: 268.59 },
      { key: 'region_3', name: '区域三', current: 318.18, base: 170.36 },
    ],
    '区域合计为门店口径：区域一 369.76、区域二 312.29、区域三 318.18（区域三含 2 家新店 143.00 万，其增减率不可与区域一/二直接比较）。',
  ),
  channel: buildStructure(
    'channel',
    '渠道',
    1000,
    759.56,
    channelSource,
    '渠道口径：2025-09 = 1000.00、2024-09 = 759.56，与利润表口径 1000.00 / 760.00 相差 0.44 万（源表取整），未做对齐。',
  ),
  channel_category: buildStructure(
    'channel_category',
    '渠道大类',
    1000,
    759.56,
    [
      { key: 'dine_in', name: '堂食', current: 906.58, base: 685 },
      { key: 'takeaway', name: '外卖', current: 93.42, base: 74.56 },
    ],
    '堂食 = 美团大众 + 扫码支付 + 线上活动优惠 + 抖音 + 会员储值消费 + 堂食现金 + 招商银行；外卖 = 美团外卖 + 饿了外卖 + 京东外卖。堂食含团购到店核销，不等于线下现金。',
  ),
  series: buildStructure(
    'series',
    '产品系列',
    1000.16,
    760,
    seriesSource,
    '品类口径：2025-09 = 1000.16、2024-09 = 760.00，与利润表口径相差 0.16 万（源表取整），未做对齐。',
  ),
}

/* ------------------------------------------------------------------ */
/* 同店异动                                                           */
/* ------------------------------------------------------------------ */

const sameStoreRows: StoreRow[] = [
  {
    store_id: 1,
    store_name: '门店1',
    region: '区域一',
    traffic: { current: 5617.89, base: 4750 },
    ticket: { current: 123, base: 122 },
    revenue: { current: 69.1, base: 58, diff: 11.1, rate: 0.191379 },
    traffic_impact: 10.59,
    ticket_impact: 0.56,
    diff: 11.1,
  },
  {
    store_id: 2,
    store_name: '门店2',
    region: '区域一',
    traffic: { current: 3514.1, base: 2700 },
    ticket: { current: 137.19, base: 136 },
    revenue: { current: 48.21, base: 37, diff: 11.21, rate: 0.302973 },
    traffic_impact: 11.07,
    ticket_impact: 0.42,
    diff: 11.21,
  },
  {
    store_id: 3,
    store_name: '门店3',
    region: '区域一',
    traffic: { current: 6996.4, base: 6420 },
    ticket: { current: 130.71, base: 130 },
    revenue: { current: 91.45, base: 83, diff: 8.45, rate: 0.101807 },
    traffic_impact: 7.49,
    ticket_impact: 0.5,
    diff: 8.45,
  },
  {
    store_id: 4,
    store_name: '门店4',
    region: '区域一',
    traffic: { current: 5371.93, base: 4610 },
    ticket: { current: 134.03, base: 133 },
    revenue: { current: 72, base: 61, diff: 11, rate: 0.180328 },
    traffic_impact: 10.13,
    ticket_impact: 0.55,
    diff: 11,
  },
  {
    store_id: 5,
    store_name: '门店5',
    region: '区域一',
    traffic: { current: 7377.32, base: 6850 },
    ticket: { current: 120.64, base: 120 },
    revenue: { current: 89, base: 82, diff: 7, rate: 0.085366 },
    traffic_impact: 6.33,
    ticket_impact: 0.47,
    diff: 7,
  },
  {
    store_id: 6,
    store_name: '门店6',
    region: '区域二',
    traffic: { current: 3898.44, base: 3198.54 },
    ticket: { current: 137.85, base: 137 },
    revenue: { current: 53.74, base: 44, diff: 9.74, rate: 0.221364 },
    traffic_impact: 9.59,
    ticket_impact: 0.33,
    diff: 9.74,
  },
  {
    store_id: 7,
    store_name: '门店7',
    region: '区域二',
    traffic: { current: 6738.54, base: 5076.23 },
    ticket: { current: 121.97, base: 122 },
    revenue: { current: 82.19, base: 62, diff: 20.19, rate: 0.325645 },
    traffic_impact: 20.28,
    ticket_impact: -0.02,
    diff: 20.19,
  },
  {
    store_id: 8,
    store_name: '门店8',
    region: '区域二',
    traffic: { current: 4710.46, base: 4124.43 },
    ticket: { current: 132.45, base: 131 },
    revenue: { current: 62.39, base: 54.03, diff: 8.36, rate: 0.154729 },
    traffic_impact: 7.68,
    ticket_impact: 0.68,
    diff: 8.36,
  },
  {
    store_id: 9,
    store_name: '门店9',
    region: '区域二',
    traffic: { current: 3953.57, base: 3960.58 },
    ticket: { current: 137.85, base: 137 },
    revenue: { current: 54.5, base: 54.26, diff: 0.24, rate: 0.004423 },
    traffic_impact: -0.1,
    ticket_impact: 0.34,
    diff: 0.24,
  },
  {
    store_id: 10,
    store_name: '门店10',
    region: '区域二',
    traffic: { current: 5039.83, base: 4601.69 },
    ticket: { current: 118, base: 118 },
    revenue: { current: 59.47, base: 54.3, diff: 5.17, rate: 0.095212 },
    traffic_impact: 5.17,
    ticket_impact: 0,
    diff: 5.17,
  },
  {
    store_id: 11,
    store_name: '门店11',
    region: '区域三',
    traffic: { current: 3307.66, base: 3073.81 },
    ticket: { current: 127.22, base: 126 },
    revenue: { current: 42.08, base: 39, diff: 3.08, rate: 0.078974 },
    traffic_impact: 2.95,
    ticket_impact: 0.4,
    diff: 3.08,
  },
  {
    store_id: 12,
    store_name: '门店12',
    region: '区域三',
    traffic: { current: 4276.24, base: 4556.15 },
    ticket: { current: 131.19, base: 130 },
    revenue: { current: 56.1, base: 59.23, diff: -3.13, rate: -0.052845 },
    traffic_impact: -3.64,
    ticket_impact: 0.51,
    diff: -3.13,
  },
  {
    store_id: 13,
    store_name: '门店13',
    region: '区域三',
    traffic: { current: 5763.9, base: 5423.31 },
    ticket: { current: 133.59, base: 133 },
    revenue: { current: 77, base: 72.13, diff: 4.87, rate: 0.067517 },
    traffic_impact: 4.53,
    ticket_impact: 0.34,
    diff: 4.87,
  },
]

export const sameStore: SameStoreData = {
  summary: {
    current: 857.23,
    base: 759.95,
    diff: 97.28,
    rate: 0.128008,
    traffic: { current: 66566.29, base: 59344.75, diff: 7221.54, rate: 0.1217 },
    ticket: { current: 128.78, base: 128.08, diff: 0.7, rate: 0.0055 },
    traffic_impact: 92.07,
    ticket_impact: 5.08,
    impact_sum: 97.16,
    variance_note:
      '两项影响合计 97.16 万，与同店收入变动 97.28 万相差 0.12 万，为源表取整尾差（不影响「增长主要来自客流」的判断）。',
  },
  stores: sameStoreRows,
  new_stores: [
    { store_id: 14, store_name: '新店1', revenue: 80 },
    { store_id: 15, store_name: '新店2', revenue: 63 },
  ],
  caliber_note:
    '同店 = 2024-09 已开业且有收入的 13 家门店；新店 = 2024-09 无收入的门店（2 家）。收入为门店口径 857.23 / 759.95（门店合计 1000.23 / 759.95），与利润表口径 1000.00 / 760.00 差 0.23 万。客流/客单影响按「先量后价」连环替代：客流影响 =（本期客流 − 基期客流）× 基期客单；客单影响 = 本期客流 ×（本期客单 − 基期客单）。',
}

const daypartsStore12: DaypartRow[] = [
  {
    day_type: '工作日',
    daypart: '9:00-14:00',
    current: 794,
    base: 950,
    diff: -156,
    rate: -0.164211,
    highlight: true,
  },
  {
    day_type: '工作日',
    daypart: '14:00-24:00',
    current: 1500,
    base: 1805,
    diff: -305,
    rate: -0.168975,
    highlight: true,
  },
  {
    day_type: '工作日',
    daypart: '24:00-5:00',
    current: 91,
    base: 95,
    diff: -4,
    rate: -0.042105,
  },
  {
    day_type: '工作日',
    daypart: '合计',
    current: 2385,
    base: 2850,
    diff: -465,
    rate: -0.163158,
    is_total: true,
  },
  {
    day_type: '节假日',
    daypart: '9:00-14:00',
    current: 585,
    base: 675,
    diff: -90,
    rate: -0.133333,
  },
  {
    day_type: '节假日',
    daypart: '14:00-24:00',
    current: 1265,
    base: 975,
    diff: 290,
    rate: 0.297436,
  },
  {
    day_type: '节假日',
    daypart: '24:00-5:00',
    current: 41,
    base: 56,
    diff: -15,
    rate: -0.267857,
  },
  {
    day_type: '节假日',
    daypart: '合计',
    current: 1891,
    base: 1706,
    diff: 185,
    rate: 0.108441,
    is_total: true,
  },
  {
    day_type: '总合计',
    daypart: '—',
    current: 4276,
    base: 4556,
    diff: -280,
    rate: -0.061457,
    is_total: true,
  },
]

export const storeDetails: Record<number, StoreDetailData> = {
  12: {
    store: { id: 12, name: '门店12', region: '区域三' },
    summary: {
      traffic: { current: 4276.24, base: 4556.15, diff: -279.91, rate: -0.061435 },
      ticket: { current: 131.19, base: 130, diff: 1.19, rate: 0.009154 },
      revenue: { current: 56.1, base: 59.23, diff: -3.13, rate: -0.052845 },
      traffic_impact: -3.64,
      ticket_impact: 0.51,
      diff: -3.13,
    },
    dayparts: daypartsStore12,
    note: '时段客流取 Excel「第二步-收入异动分析」B103:H114；该表门店合计 4,276 人次与同店客流表 66,566 人次相差约 15 倍（源表口径不一致，疑似单店/单日/桌数口径），页面按导入值展示，不强行对齐。',
  },
}

export function getStoreDetail(storeId: number): StoreDetailData | null {
  const preset = storeDetails[storeId]
  if (preset) return preset
  const row = sameStoreRows.find((item) => item.store_id === storeId)
  if (!row) return null
  return {
    store: { id: row.store_id, name: row.store_name, region: row.region },
    summary: {
      traffic: {
        current: row.traffic.current,
        base: row.traffic.base,
        diff: r2(row.traffic.current - row.traffic.base),
        rate: row.traffic.base ? r4(row.traffic.current / row.traffic.base - 1) : null,
      },
      ticket: {
        current: row.ticket.current,
        base: row.ticket.base,
        diff: r2(row.ticket.current - row.ticket.base),
        rate: row.ticket.base ? r4(row.ticket.current / row.ticket.base - 1) : null,
      },
      revenue: row.revenue,
      traffic_impact: row.traffic_impact,
      ticket_impact: row.ticket_impact,
      diff: row.diff,
    },
    dayparts: [],
    note: '该门店的时段客流明细未导入：一期示例数据仅提供门店12 的时段下钻；接入「时段客流」数据集后自动展示。',
  }
}

/* ------------------------------------------------------------------ */
/* 渠道                                                               */
/* ------------------------------------------------------------------ */

export const channelData: ChannelData = {
  total: { current: 1000, base: 759.56, diff: 240.44 },
  rows: [
    {
      channel_id: 1,
      name: '美团大众',
      current: 460,
      base: 336,
      same_store: 394.23,
      new_store: 65.77,
      diff: 58.24,
      rate: 0.1733,
      same_rate: 0.1733,
      share: 0.46,
    },
    {
      channel_id: 2,
      name: '扫码支付',
      current: 316,
      base: 252,
      same_store: 270.82,
      new_store: 45.18,
      diff: 18.82,
      rate: 0.074692,
      same_rate: 0.074692,
      share: 0.316,
    },
    {
      channel_id: 3,
      name: '线上活动优惠',
      current: 101,
      base: 82,
      same_store: 86.56,
      new_store: 14.44,
      diff: 4.56,
      rate: 0.055614,
      same_rate: 0.055614,
      share: 0.101,
    },
    {
      channel_id: 4,
      name: '美团外卖',
      current: 60,
      base: 46,
      same_store: 51.42,
      new_store: 8.58,
      diff: 5.42,
      rate: 0.117869,
      same_rate: 0.117869,
      share: 0.06,
    },
    {
      channel_id: 5,
      name: '饿了外卖',
      current: 32,
      base: 27.55,
      same_store: 27.43,
      new_store: 4.57,
      diff: -0.12,
      rate: -0.004535,
      same_rate: -0.004535,
      share: 0.032,
    },
    {
      channel_id: 6,
      name: '抖音',
      current: 16,
      base: 3,
      same_store: 13.71,
      new_store: 2.29,
      diff: 10.71,
      rate: 3.570842,
      same_rate: 3.570842,
      share: 0.016,
    },
    {
      channel_id: 7,
      name: '会员储值消费',
      current: 7,
      base: 5,
      same_store: 6,
      new_store: 1,
      diff: 1,
      rate: 0.199846,
      same_rate: 0.199846,
      share: 0.007,
    },
    {
      channel_id: 8,
      name: '堂食现金',
      current: 3.58,
      base: 3.5,
      same_store: 3.07,
      new_store: 0.51,
      diff: -0.43,
      rate: -0.123378,
      same_rate: -0.123378,
      share: 0.00358,
    },
    {
      channel_id: 9,
      name: '招商银行',
      current: 3,
      base: 3.5,
      same_store: 2.57,
      new_store: 0.43,
      diff: -0.93,
      rate: -0.2654,
      same_rate: -0.2654,
      share: 0.003,
    },
    {
      channel_id: 10,
      name: '京东外卖',
      current: 1.42,
      base: 1.01,
      same_store: 1.22,
      new_store: 0.2,
      diff: 0.21,
      rate: 0.204937,
      same_rate: 0.204937,
      share: 0.00142,
    },
  ],
  categories: [
    { name: '堂食', current: 906.58, base: 685, diff: 221.58, rate: 0.323474 },
    { name: '外卖', current: 93.42, base: 74.56, diff: 18.86, rate: 0.252951 },
  ],
  caliber_note:
    '渠道口径 1000.00 / 759.56（与利润表 1000.00 / 760.00 差 0.44 万，源表取整）。同店/新店分摊采用「本期渠道占比」：新店分摊 = 该渠道本期收入 ×（新店收入 143.00 ÷ 总收入 1000.00）；同店 = 本期 − 新店分摊。Excel 另有按同期占比分摊的结果（美团大众同店 396.74 / 新店 63.26），与本期占比口径差 0.20 万。',
}

export const channelDetail: ChannelDetailData = {
  channel: { id: 1, name: '美团大众', category: '堂食' },
  funnel: {
    exposure: 4367174,
    visits: 639025,
    payers: 73113,
    consumers: 64468,
    exposure_visit: 0.1463,
    visit_pay: 0.1144,
    pay_consume: 0.8818,
    exposure_pay: 0.0167,
    mom_change: { exposure_visit: null, visit_pay: -0.012, pay_consume: null },
    brand_customers: 69298,
    new_customers: 59703,
    old_customers: 9595,
  },
  economics: {
    revenue: 460,
    platform_fee: 138,
    fee_rate: 0.3,
    gross_profit: 276,
    gross_roi: 2,
    sales_roi: 3.33,
    thresholds: { fee_rate: 0.15, gross_roi: 1, sales_roi: 4 },
    status: { fee_rate: 'risk', gross_roi: 'ok', sales_roi: 'warning' },
  },
  note: '漏斗口径：曝光 → 访问 → 支付 → 消费人数；品牌顾客 69,298 = 新客 59,703 + 老客 9,595。阈值：平台费用率 ≤ 15.0%、毛利 ROI ≥ 1.0、销售 ROI ≥ 4.0（PPT p28，阈值可配置）。',
}

export function getChannelDetail(channelId: number): ChannelDetailData | null {
  if (channelId === 1) return channelDetail
  const row = channelData.rows.find((item) => item.channel_id === channelId)
  if (!row) return null
  return {
    channel: { id: row.channel_id, name: row.name },
    funnel: null,
    economics: null,
    note: '该渠道暂无线上漏斗与平台费用数据：一期示例数据只导入「大众点评/美团大众」的标杆曝光转化与平台费用。可在「数据导入 → 线上漏斗」补充后查看。',
  }
}

/* ------------------------------------------------------------------ */
/* 产品下钻                                                           */
/* ------------------------------------------------------------------ */

const seriesSame: SeriesRow[] = [
  {
    name: '肉类',
    qty: { current: 130377.84, base: 113280 },
    price: { current: 35.9, base: 34.25 },
    revenue: { current: 468, base: 388 },
    qty_impact: 58.56,
    price_impact: 21.44,
    diff: 80,
  },
  {
    name: '锅底类',
    qty: { current: 20076.85, base: 24010 },
    price: { current: 26.5, base: 22.07 },
    revenue: { current: 53.21, base: 53 },
    qty_impact: -8.68,
    price_impact: 8.9,
    diff: 0.22,
  },
  {
    name: '涮品类',
    qty: { current: 92288.73, base: 80860 },
    price: { current: 19.58, base: 17.44 },
    revenue: { current: 180.71, base: 141 },
    qty_impact: 19.93,
    price_impact: 19.79,
    diff: 39.72,
  },
  {
    name: '主食类',
    qty: { current: 32330.71, base: 27658 },
    price: { current: 12.14, base: 27.48 },
    revenue: { current: 39.26, base: 76 },
    qty_impact: 12.84,
    price_impact: -49.58,
    diff: -36.74,
  },
  {
    name: '凉菜类',
    qty: { current: 4805.38, base: 17511 },
    price: { current: 14.57, base: 8.57 },
    revenue: { current: 7, base: 15 },
    qty_impact: -10.88,
    price_impact: 2.89,
    diff: -7.99,
  },
  {
    name: '小料类',
    qty: { current: 69673.35, base: 43251 },
    price: { current: 9.49, base: 8.79 },
    revenue: { current: 66.13, base: 38 },
    qty_impact: 23.21,
    price_impact: 4.91,
    diff: 28.12,
  },
  {
    name: '饮品',
    qty: { current: 26058.94, base: 28668 },
    price: { current: 16.12, base: 15 },
    revenue: { current: 41.99, base: 43 },
    qty_impact: -3.91,
    price_impact: 2.91,
    diff: -1,
  },
  {
    name: '其它',
    qty: { current: 66914.56, base: 62412 },
    price: { current: 0.13, base: 0.96 },
    revenue: { current: 0.86, base: 6 },
    qty_impact: 0.43,
    price_impact: -5.58,
    diff: -5.15,
  },
]

const seriesAll: SeriesRow[] = [
  {
    name: '肉类',
    qty: { current: 152127, base: 113280 },
    price: { current: 35.9, base: 34.25 },
    revenue: { current: 546.07, base: 388 },
    qty_impact: 133.06,
    price_impact: 25.01,
    diff: 158.07,
  },
  {
    name: '锅底类',
    qty: { current: 23426, base: 24010 },
    price: { current: 26.5, base: 22.07 },
    revenue: { current: 62.09, base: 53 },
    qty_impact: -1.29,
    price_impact: 10.38,
    diff: 9.09,
  },
  {
    name: '涮品类',
    qty: { current: 107684, base: 80860 },
    price: { current: 19.58, base: 17.44 },
    revenue: { current: 210.86, base: 141 },
    qty_impact: 46.77,
    price_impact: 23.09,
    diff: 69.86,
  },
  {
    name: '主食类',
    qty: { current: 37724, base: 27658 },
    price: { current: 12.14, base: 27.48 },
    revenue: { current: 45.81, base: 76 },
    qty_impact: 27.66,
    price_impact: -57.85,
    diff: -30.19,
  },
  {
    name: '凉菜类',
    qty: { current: 5607, base: 17511 },
    price: { current: 14.57, base: 8.57 },
    revenue: { current: 8.17, base: 15 },
    qty_impact: -10.2,
    price_impact: 3.37,
    diff: -6.83,
  },
  {
    name: '小料类',
    qty: { current: 81296, base: 43251 },
    price: { current: 9.49, base: 8.79 },
    revenue: { current: 77.16, base: 38 },
    qty_impact: 33.43,
    price_impact: 5.73,
    diff: 39.16,
  },
  {
    name: '饮品',
    qty: { current: 30406, base: 28668 },
    price: { current: 16.12, base: 15 },
    revenue: { current: 49, base: 43 },
    qty_impact: 2.61,
    price_impact: 3.39,
    diff: 6,
  },
  {
    name: '其它',
    qty: { current: 78077, base: 62412 },
    price: { current: 0.13, base: 0.96 },
    revenue: { current: 1, base: 6 },
    qty_impact: 1.51,
    price_impact: -6.51,
    diff: -5,
  },
]

const setMeal = {
  current: {
    qty: 5472,
    amount: 444217.54,
    avg_price: 81.18,
    dish_revenue: 214128.87,
    discount: 230088.67,
    discount_rate: 0.51797,
  },
  base: {
    qty: 432,
    amount: 66080,
    avg_price: 152.96,
    dish_revenue: 33197.11,
    discount: 32882.89,
    discount_rate: 0.49761,
  },
  qty_impact: 770933.33,
  price_impact: -392795.79,
  diff: 378137.54,
}

export const productSameStore: ProductData = {
  scope: 'same_store',
  total: { current: 857.17, base: 760, diff: 97.17, qty_impact: 91.5, price_impact: 5.67 },
  series: seriesSame,
  sets: setMeal,
  conclusion:
    '同店菜品增收 97 万：主要来自肉类、涮品类、小料类的销量增加（销量影响 +91.50 万），单价影响 +5.67 万；但主食类单价下降 15 元导致收入下降 50 万（单价影响 -49.58 万、销量影响 +12.84 万，合计 -36.74 万）。',
  note: '同店量价合计 97.17 万，与同店收入变动 97.28 万相差 0.11 万，为品类口径取整尾差。',
}

export const productAll: ProductData = {
  scope: 'all',
  total: { current: 1000.16, base: 760, diff: 240.16, qty_impact: 233.54, price_impact: 6.62 },
  series: seriesAll,
  sets: setMeal,
  conclusion:
    '全店菜品增收 240.16 万，其中销量影响 +233.54 万（肉类 +133.06、涮品类 +46.77、小料类 +33.43）、单价影响 +6.62 万；主食类单价 27.48 → 12.14 元，单价影响 -57.85 万。',
  note: '品类口径 1000.16 / 760.00，与利润表口径 1000.00 / 760.00 差 0.16 万，为源表取整尾差，未做对齐。',
}

/* ------------------------------------------------------------------ */
/* 结论与计划                                                         */
/* ------------------------------------------------------------------ */

export const conclusionData: ConclusionData = {
  summary: {
    new_store: 143,
    same_store_traffic: 92.07,
    same_store_ticket: 5.08,
    closed_store: 0,
    impact_sum: 240.15,
    total_diff: 240.28,
    variance_note:
      '四项合计 240.15 万，与收入变动 240.28 万相差 0.13 万，为源表取整尾差（门店口径 1000.23 / 759.95）。',
  },
  conclusions: [
    '收入同比 +240.28 万元（+31.6%）：新店贡献 +143.00 万元、同店客流 +92.07 万元、同店客单 +5.08 万元、闭店 0，增长由「开新店 + 同店客流」共同驱动。',
    '同店增收 97.28 万元中客流贡献 92.07 万元（占 94.8%），客单基本持平（+0.55%），说明增长主要来自来客数而不是提价，可持续性较好。',
    '渠道侧美团大众 +124.00 万元（+36.9%）是最大增长来源；门店12 是唯一收入与客流双降门店（-3.13 万元 / -280 人次），且下滑集中在工作日 9:00-14:00 与 14:00-24:00。',
    '利润侧其它费用 +37.00 万元、店铺房租 +13.76 万元、工资奖金 +12.03 万元合计拖累 -62.79 万元，需要在费用分析模块（二期）进一步定位。',
  ],
  actions: [
    {
      title: '巩固线上放量',
      detail:
        '美团大众同比 +124.00 万元、同店 +58.24 万元；建议维持点评投放与团购供给，同时把平台费用率从 30.0% 压到 15.0% 阈值内，销售 ROI 由 3.33 提升到 4.00 以上。',
      owner: '市场部 / 运营部',
    },
    {
      title: '挽回门店12 工作日常规时段客流',
      detail:
        '门店12 工作日客流 -465 人次（-16.3%），其中 9:00-14:00 -156、14:00-24:00 -305；建议排查周边竞对与午市排班，设计工作日到店活动，并在下月复核节假日 +185 人次的正向经验。',
      owner: '运营部 / 区域三',
    },
    {
      title: '止住主食类降价换量',
      detail:
        '主食类单价 27.48 → 12.14 元，单价影响 -49.58 万元，销量影响 +12.84 万元无法弥补；建议复核套餐定价与分量结构，把「降价换量」改为「结构升级」，避免继续稀释毛利。',
      owner: '产品部 / 财务部',
    },
  ],
  caliber_note:
    '异动汇总使用门店口径（总收入 1000.23 / 759.95，收入变动 +240.28）；各项之和 240.15 万与 240.28 万差 0.13 万为源表取整尾差，页面不改写任一数字。',
}

/* ------------------------------------------------------------------ */
/* 数据导入                                                           */
/* ------------------------------------------------------------------ */

export const datasetNames: Record<string, string> = {
  pl: '月度利润表',
  store: '门店收入',
  channel: '渠道收入',
  product_series: '产品系列销售',
  product: '单品销售',
  funnel: '线上漏斗',
  daypart: '时段客流',
  budget: '预算与目标',
}

export const templates: ImportTemplate[] = [
  {
    key: 'pl',
    name: '月度利润表',
    columns: [
      '期间',
      '门店（品牌填「全部」）',
      '营业收入',
      '食材成本',
      '优惠及手续费',
      '水电气低值',
      '宣传费用',
      '工资奖金',
      '宿舍房租',
      '店铺房租',
      '其它费用',
      '税金及附加（可选）',
    ],
    note: '期间 YYYY-MM；金额 ≥ 0（万元）；9 个科目齐全（缺项给警告）。',
  },
  {
    key: 'store',
    name: '门店收入',
    columns: ['期间', '门店', '区域', '经营模式', '店型', '营业收入（万元）', '客流（人次）', '同店/新店/闭店标识（可选）'],
    note: '收入 ≥ 0；客流 ≥ 0；收入 ÷ 客流 反算客单价与申报客单价差异 > 1% 给警告。',
  },
  {
    key: 'channel',
    name: '渠道收入',
    columns: ['期间', '门店', '渠道', '渠道大类', '收入（万元）'],
    note: '渠道在渠道清单内；同期间同门店渠道合计与门店收入差 > 1% 给警告。',
  },
  {
    key: 'product_series',
    name: '产品系列销售',
    columns: ['期间', '门店', '产品系列', '销售数量', '销售额（元）', '菜品收入（元）', '菜品优惠（元）', '实际成本（可选）', '理论单位成本（可选）'],
    note: '数量/金额 ≥ 0；单品之和与系列合计差 > 1% 给警告。',
  },
  {
    key: 'product',
    name: '单品销售',
    columns: ['期间', '门店', '产品系列', '产品名称', '销售数量', '销售额（元）', '菜品收入（元）', '菜品优惠（元）', '是否套餐（可选）'],
    note: '产品系列必须已存在；套餐与单品分开统计。',
  },
  {
    key: 'funnel',
    name: '线上漏斗',
    columns: ['期间', '门店', '渠道', '曝光人数', '访问人数', '支付人数', '消费人数', '平台费用（元）', '品牌顾客（可选）', '新客（可选）', '老客（可选）'],
    note: '逐级递减（曝光 ≥ 访问 ≥ 支付 ≥ 消费）；缺失值留空不补 0。',
  },
  {
    key: 'daypart',
    name: '时段客流',
    columns: ['期间', '门店', '日类型（工作日/节假日）', '时段', '客流'],
    note: '日类型二选一；时段统一为 9:00-14:00 这类格式；同日类型合计与门店客流差 > 1% 给警告。',
  },
  {
    key: 'budget',
    name: '预算与目标',
    columns: ['期间', '门店', '科目', '预算值（万元）', '渠道', '新客量', '曝光转化率', '客单价', '毛利率', '新客成本', '目标 ROI'],
    note: '预算科目在标准科目表内；目标值区间合理（转化率 0–1、毛利率 0–1、ROI > 0）。',
  },
]

export const datasets: DatasetReadiness[] = [
  { key: 'pl', name: '月度利润表', ready: true, rows: 10 },
  { key: 'store', name: '门店收入', ready: true, rows: 15 },
  { key: 'channel', name: '渠道收入', ready: true, rows: 10 },
  { key: 'product_series', name: '产品系列销售', ready: true, rows: 8 },
  { key: 'product', name: '单品销售', ready: false, rows: 0 },
  { key: 'funnel', name: '线上漏斗', ready: true, rows: 10 },
  { key: 'daypart', name: '时段客流', ready: true, rows: 9 },
  { key: 'budget', name: '预算与目标', ready: true, rows: 9 },
]

export function buildDataStatus(period: string): DataStatusData {
  if (period === '2025-09') {
    return {
      period,
      modules: {
        dashboard: { ready: true, missing: [] },
        revenue: { ready: true, missing: [] },
        profit: { ready: true, missing: [] },
      },
      datasets,
    }
  }
  return {
    period,
    modules: {
      dashboard: { ready: false, missing: ['月度利润表', '门店收入'] },
      revenue: { ready: false, missing: ['门店收入', '渠道收入', '产品系列销售', '时段客流'] },
      profit: { ready: false, missing: ['月度利润表'] },
    },
    datasets: datasets.map((item) => ({ ...item, ready: false, rows: 0 })),
  }
}

export const importPreviews: Record<string, Record<string, string | number>[]> = {
  pl: [
    {
      期间: '2025-09',
      门店: '全部',
      营业收入: 1000,
      食材成本: 267,
      优惠及手续费: 234.96,
      水电气低值: 39.94,
      宣传费用: 27.35,
      工资奖金: 147.03,
      宿舍房租: 17.16,
      店铺房租: 69.86,
      其它费用: 84,
    },
  ],
  store: [
    { 期间: '2025-09', 门店: '门店1', 区域: '区域一', 经营模式: '直营', 店型: 'MALL', '营业收入（万元）': 69.1, '客流（人次）': 5617.89 },
    { 期间: '2025-09', 门店: '门店12', 区域: '区域三', 经营模式: '直营', 店型: '社区街边', '营业收入（万元）': 56.1, '客流（人次）': 4276.24 },
  ],
  channel: [
    { 期间: '2025-09', 门店: '全部', 渠道: '美团大众', 渠道大类: '堂食', '收入（万元）': 460 },
    { 期间: '2025-09', 门店: '全部', 渠道: '扫码支付', 渠道大类: '堂食', '收入（万元）': 316 },
  ],
  product_series: [
    { 期间: '2025-09', 门店: '全部', 产品系列: '肉类', 销售数量: 152127, '销售额（元）': 5460700, '菜品收入（元）': 5460700, '菜品优惠（元）': 0 },
  ],
  product: [],
  funnel: [
    {
      期间: '2025-09',
      门店: '全部',
      渠道: '美团大众',
      曝光人数: 4367174,
      访问人数: 639025,
      支付人数: 73113,
      消费人数: 64468,
      '平台费用（元）': 1380000,
    },
  ],
  daypart: [
    { 期间: '2025-09', 门店: '门店12', '日类型（工作日/节假日）': '工作日', 时段: '9:00-14:00', 客流: 794 },
    { 期间: '2025-09', 门店: '门店12', '日类型（工作日/节假日）': '节假日', 时段: '14:00-24:00', 客流: 1265 },
  ],
  budget: [
    {
      期间: '2025-09',
      门店: '全部',
      科目: '营业收入',
      '预算值（万元）': 1050,
      渠道: '大众点评',
      新客量: 820,
      曝光转化率: 0.015,
      客单价: 100,
      毛利率: 0.6,
      新客成本: 30,
      目标ROI: 2,
    },
  ],
}

export const initialBatches: ImportBatch[] = [
  {
    id: 'IMP-20251008-001',
    dataset: 'pl',
    dataset_name: '月度利润表',
    filename: '月度利润表-2025-09.xlsx',
    period: '2025-09',
    row_count: 10,
    operator: 'admin',
    created_at: '2025-10-08 09:12',
    status: 'committed',
  },
  {
    id: 'IMP-20251008-002',
    dataset: 'channel',
    dataset_name: '渠道收入',
    filename: '渠道收入-2025-09.xlsx',
    period: '2025-09',
    row_count: 10,
    operator: 'admin',
    created_at: '2025-10-08 09:18',
    status: 'committed',
  },
  {
    id: 'IMP-20251007-003',
    dataset: 'store',
    dataset_name: '门店收入',
    filename: '门店收入-2025-08.xlsx',
    period: '2025-08',
    row_count: 15,
    operator: 'admin',
    created_at: '2025-10-07 18:40',
    status: 'rolled_back',
  },
]

export const importErrorSample = [
  { row: 3, column: '期间', message: '期间格式应为 YYYY-MM，当前值「2025/9」', severity: 'error' as const },
  { row: 5, column: '营业收入', message: '金额不能为负数（当前 -12.00）', severity: 'error' as const },
  { row: 2, column: '客流', message: '收入 ÷ 客流 反算客单价与申报值差异 1.8%，请复核', severity: 'warning' as const },
]

export type MockEnvelopeData =
  | OverviewData
  | ProfitData
  | StructureData
  | SameStoreData
  | StoreDetailData
  | ChannelData
  | ChannelDetailData
  | ProductData
  | ConclusionData

export type MockEnvelope = ApiEnvelope<MockEnvelopeData>
