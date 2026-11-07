/**
 * 前后端接口类型（与 shared/api-contract.md 对齐）。
 * 约定：金额单位万元（产品/套餐为元）、比率为 0–1 小数、无法计算一律 null（前端显示「—」）。
 */

export type Baseline = 'yoy' | 'budget' | 'mom'
export type PeriodMode = 'month' | 'ytd'

export interface Filters {
  brand: string
  store: string
  period: string
  mode: PeriodMode
  baseline: Baseline
}

export type InsightLevel = 'positive' | 'negative' | 'info'

export interface Insight {
  level: InsightLevel
  title: string
  text: string
  evidence: string
}

export interface ApiMeta {
  brand: string
  store: string
  period: string
  baseline: Baseline
  unit: string
  mode: PeriodMode
}

export interface ApiEnvelope<T> {
  data: T
  meta: ApiMeta
  insights: Insight[]
}

export interface AuthUser {
  username: string
}

/** KPI 值：value/base/diff 与单位；diff 单位含义见 unit */
export interface KpiValue {
  value: number | null
  base: number | null
  diff: number | null
  rate?: number | null
  unit: '万元' | '%' | 'pp' | '人次' | '元'
}

export interface Percentile {
  p25: number
  p50: number
  p75: number
  current: number | null
  bucket: string | null
}

export type Percentiles = Record<string, Percentile>

export interface BridgeItem {
  key: string
  name: string
  impact: number
  kind: 'positive' | 'negative'
  note: string
}

export interface ProfitBridge {
  start: number
  end: number
  items: BridgeItem[]
}

export interface OverviewData {
  kpis: {
    revenue: KpiValue
    profit: KpiValue
    gross_margin: KpiValue
    same_store_growth: KpiValue
  }
  profit_bridge: ProfitBridge
  percentiles: Percentiles
  /** 无法计算分位时的说明（例如门店级数据未导入） */
  percentile_hints?: Record<string, string>
  summary: string
  note?: string
}

export interface ProfitRow {
  account: string
  current: number | null
  current_ratio: number | null
  base: number | null
  base_ratio: number | null
  diff: number | null
  rate: number | null
  ratio_pp: number | null
  is_total?: boolean
  is_subtotal?: boolean
  /** 科目性质：收入 / 成本费用 / 毛利额小计 / 营业利润合计 */
  kind?: 'revenue' | 'cost' | 'subtotal' | 'profit'
}

export interface ProfitData {
  rows: ProfitRow[]
  profit: { current: number; base: number; diff: number }
  profit_bridge: ProfitBridge
  budget: null
  mode: PeriodMode
  note: string
}

export type StructureDimension =
  | 'business_model'
  | 'store_type'
  | 'region'
  | 'channel'
  | 'channel_category'
  | 'series'

export interface StructureRow {
  key: string
  name: string
  current: number
  current_share: number | null
  base: number
  base_share: number | null
  diff: number
  rate: number | null
}

export interface StructureData {
  dimension: StructureDimension
  dimension_name: string
  total: { current: number; base: number; diff: number; rate: number | null }
  rows: StructureRow[]
  caliber_note: string
}

export interface TrafficTicket {
  current: number
  base: number
  diff?: number
  rate?: number | null
}

export interface StoreRow {
  store_id: number
  store_name: string
  region: string
  traffic: TrafficTicket
  ticket: TrafficTicket
  revenue: { current: number; base: number; diff: number; rate: number | null }
  traffic_impact: number
  ticket_impact: number
  diff: number
}

export interface SameStoreSummary {
  current: number
  base: number
  diff: number
  rate: number | null
  traffic: TrafficTicket & { diff: number; rate: number | null }
  ticket: TrafficTicket & { diff: number; rate: number | null }
  traffic_impact: number
  ticket_impact: number
  impact_sum: number
  variance_note: string
}

export interface SameStoreData {
  summary: SameStoreSummary
  stores: StoreRow[]
  new_stores: { store_id: number; store_name: string; revenue: number }[]
  caliber_note: string
}

export interface DaypartRow {
  day_type: string
  daypart: string
  current: number
  base: number
  diff: number
  rate: number | null
  is_total?: boolean
  highlight?: boolean
}

export interface StoreDetailData {
  store: { id: number; name: string; region: string }
  summary: {
    traffic: TrafficTicket
    ticket: TrafficTicket
    revenue: { current: number; base: number; diff: number; rate: number | null }
    traffic_impact: number
    ticket_impact: number
    diff: number
  }
  dayparts: DaypartRow[]
  note: string
}

export interface ChannelRow {
  channel_id: number
  name: string
  current: number
  base: number
  same_store: number
  new_store: number
  diff: number
  rate: number | null
  same_rate: number | null
  share: number
}

export interface ChannelCategory {
  name: string
  current: number
  base: number
  diff: number
  rate: number | null
}

export interface ChannelData {
  total: { current: number; base: number; diff: number }
  rows: ChannelRow[]
  categories: ChannelCategory[]
  caliber_note: string
}

export interface FunnelData {
  exposure: number
  visits: number
  payers: number
  consumers: number
  exposure_visit: number
  visit_pay: number
  pay_consume: number
  exposure_pay: number
  mom_change: {
    exposure_visit: number | null
    visit_pay: number | null
    pay_consume: number | null
  }
  brand_customers: number
  new_customers: number
  old_customers: number
}

export type ThresholdStatus = 'ok' | 'warning' | 'risk'

export interface ChannelEconomics {
  revenue: number
  platform_fee: number
  fee_rate: number
  gross_profit: number
  gross_roi: number
  sales_roi: number
  thresholds: { fee_rate: number; gross_roi: number; sales_roi: number }
  status: { fee_rate: ThresholdStatus; gross_roi: ThresholdStatus; sales_roi: ThresholdStatus }
}

export interface ChannelDetailData {
  channel: { id: number; name: string; category?: string }
  funnel: FunnelData | null
  economics: ChannelEconomics | null
  note?: string
}

export interface SeriesRow {
  name: string
  qty: { current: number; base: number }
  price: { current: number; base: number }
  revenue: { current: number; base: number }
  qty_impact: number
  price_impact: number
  diff: number
}

export interface SetMealPeriod {
  qty: number
  amount: number
  avg_price: number
  dish_revenue: number
  discount: number
  discount_rate: number
}

export interface SetMealData {
  current: SetMealPeriod
  base: SetMealPeriod
  qty_impact: number
  price_impact: number
  diff: number
}

export interface ProductItemRow {
  product_id: number | null
  name: string
  is_set: boolean
  qty: { current: number; base: number }
  amount: { current: number; base: number }
  price: { current: number; base: number }
  qty_impact: number
  price_impact: number
  diff: number
}

export interface ProductData {
  scope: 'all' | 'same_store'
  items?: ProductItemRow[]
  total: {
    current: number
    base: number
    diff: number
    qty_impact: number
    price_impact: number
  }
  series: SeriesRow[]
  sets: SetMealData
  conclusion: string
  note: string
}

export interface ActionItem {
  title: string
  detail: string
  owner: string
}

export interface ConclusionData {
  summary: {
    new_store: number
    same_store_traffic: number
    same_store_ticket: number
    closed_store: number
    impact_sum: number
    total_diff: number
    variance_note: string
  }
  conclusions: string[]
  actions: ActionItem[]
  caliber_note: string
}

export interface DatasetReadiness {
  key: string
  name: string
  ready: boolean
  rows: number
}

export interface ModuleReadiness {
  ready: boolean
  missing: string[]
}

export interface DataStatusData {
  period: string
  modules: Record<string, ModuleReadiness>
  datasets: DatasetReadiness[]
}

export interface ImportTemplate {
  key: string
  name: string
  columns: string[]
  note?: string
}

export interface ImportErrorRow {
  row: number
  column: string
  message: string
  severity: 'error' | 'warning'
}

export type ImportPreviewRow = Record<string, string | number>

export type ImportBatchStatus = 'draft' | 'committed' | 'rolled_back'

export interface ImportBatch {
  id: string
  dataset: string
  dataset_name: string
  filename: string
  period: string
  row_count: number
  operator: string
  created_at: string
  status: ImportBatchStatus
  errors?: ImportErrorRow[]
  preview?: ImportPreviewRow[]
}

export interface SeedLoadResult {
  ok: boolean
  datasets: number
  message: string
}
