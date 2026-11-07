/**
 * 指标元数据：好坏方向（越高越好 / 越低越好）与展示格式的唯一定义。
 * 语义色不能只看数值正负：成本率上升是负向，收入上升是正向。
 * 见 openspec/changes/build-catering-analysis-platform/specs/app-workspace/spec.md。
 */
import { color } from '../theme'
import type { DeltaFormat } from './format'

export type Semantic = 'positive' | 'negative' | 'flat'
export type GoodDirection = 'up' | 'down'
export type MetricFormat = 'currency' | 'percent' | 'pp' | 'number' | 'count'

export interface MetricMeta {
  key: string
  label: string
  /** up = 越高越好；down = 越低越好 */
  goodDirection: GoodDirection
  format: MetricFormat
  deltaFormat: DeltaFormat
  unit: string
}

export const METRICS = {
  revenue: {
    key: 'revenue',
    label: '营业收入',
    goodDirection: 'up',
    format: 'currency',
    deltaFormat: 'currency',
    unit: '万元',
  },
  profit: {
    key: 'profit',
    label: '营业利润',
    goodDirection: 'up',
    format: 'currency',
    deltaFormat: 'currency',
    unit: '万元',
  },
  gross_margin: {
    key: 'gross_margin',
    label: '综合毛利率',
    goodDirection: 'up',
    format: 'percent',
    deltaFormat: 'pp',
    unit: '',
  },
  same_store_growth: {
    key: 'same_store_growth',
    label: '同店增速',
    goodDirection: 'up',
    format: 'percent',
    deltaFormat: 'pp',
    unit: '',
  },
  food_cost_rate: {
    key: 'food_cost_rate',
    label: '食材成本率',
    goodDirection: 'down',
    format: 'percent',
    deltaFormat: 'pp',
    unit: 'pp',
  },
  discount_fee_rate: {
    key: 'discount_fee_rate',
    label: '优惠及手续费率',
    goodDirection: 'down',
    format: 'percent',
    deltaFormat: 'pp',
    unit: 'pp',
  },
  utilities_rate: {
    key: 'utilities_rate',
    label: '水电气低值率',
    goodDirection: 'down',
    format: 'percent',
    deltaFormat: 'pp',
    unit: 'pp',
  },
  marketing_rate: {
    key: 'marketing_rate',
    label: '宣传费用率',
    goodDirection: 'down',
    format: 'percent',
    deltaFormat: 'pp',
    unit: 'pp',
  },
  salary: {
    key: 'salary',
    label: '工资奖金',
    goodDirection: 'down',
    format: 'currency',
    deltaFormat: 'currency',
    unit: '万元',
  },
  dorm_rent: {
    key: 'dorm_rent',
    label: '宿舍房租',
    goodDirection: 'down',
    format: 'currency',
    deltaFormat: 'currency',
    unit: '万元',
  },
  store_rent: {
    key: 'store_rent',
    label: '店铺房租',
    goodDirection: 'down',
    format: 'currency',
    deltaFormat: 'currency',
    unit: '万元',
  },
  other_expense: {
    key: 'other_expense',
    label: '其它费用',
    goodDirection: 'down',
    format: 'currency',
    deltaFormat: 'currency',
    unit: '万元',
  },
  traffic: {
    key: 'traffic',
    label: '客流',
    goodDirection: 'up',
    format: 'count',
    deltaFormat: 'count',
    unit: '人次',
  },
  ticket: {
    key: 'ticket',
    label: '客单价',
    goodDirection: 'up',
    format: 'number',
    deltaFormat: 'number',
    unit: '元',
  },
  fee_rate: {
    key: 'fee_rate',
    label: '平台费用率',
    goodDirection: 'down',
    format: 'percent',
    deltaFormat: 'pp',
    unit: '%',
  },
  gross_roi: {
    key: 'gross_roi',
    label: '毛利 ROI',
    goodDirection: 'up',
    format: 'number',
    deltaFormat: 'number',
    unit: '',
  },
  sales_roi: {
    key: 'sales_roi',
    label: '销售 ROI',
    goodDirection: 'up',
    format: 'number',
    deltaFormat: 'number',
    unit: '',
  },
} as const satisfies Record<string, MetricMeta>

export type MetricKey = keyof typeof METRICS

export function getMetric(metric: MetricKey | string): MetricMeta | null {
  return (METRICS as Record<string, MetricMeta>)[metric] ?? null
}

/** 核心判断：按指标好坏方向把差异转成语义色 */
export function semanticFromDiff(diff: number | null | undefined, goodDirection: GoodDirection): Semantic {
  if (diff === null || diff === undefined || Number.isNaN(diff)) return 'flat'
  if (Math.abs(diff) < 1e-9) return 'flat'
  if (goodDirection === 'up') return diff > 0 ? 'positive' : 'negative'
  return diff < 0 ? 'positive' : 'negative'
}

/** 按指标 key 判断差异的语义（未知指标按「越高越好」处理） */
export function semanticOf(metric: MetricKey | string, diff: number | null | undefined): Semantic {
  const meta = getMetric(metric)
  return semanticFromDiff(diff, meta?.goodDirection ?? 'up')
}

export function isUpGood(metric: MetricKey | string): boolean {
  return (getMetric(metric)?.goodDirection ?? 'up') === 'up'
}

export function semanticColor(semantic: Semantic): string {
  if (semantic === 'positive') return color.positive
  if (semantic === 'negative') return color.negative
  return color.neutral
}

export function semanticClass(semantic: Semantic): string {
  return `semantic-${semantic}`
}

export function semanticLabel(semantic: Semantic): string {
  if (semantic === 'positive') return '正向'
  if (semantic === 'negative') return '负向'
  return '持平'
}

export function goodDirectionLabel(metric: MetricKey | string): string {
  return isUpGood(metric) ? '越高越好' : '越低越好'
}
