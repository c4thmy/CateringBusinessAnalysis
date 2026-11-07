import type { Filters } from '../api/types'

export interface Option {
  value: string
  label: string
}

export const DEFAULT_FILTERS: Filters = {
  brand: 'all',
  store: 'all',
  period: '2025-09',
  mode: 'month',
  baseline: 'yoy',
}

export const BRAND_OPTIONS: Option[] = [
  { value: 'all', label: '全部品牌' },
  { value: 'yangbo', label: '杨博鸡公煲' },
]

export const STORE_OPTIONS: Option[] = [
  { value: 'all', label: '全部门店' },
  ...Array.from({ length: 13 }, (_, index) => ({
    value: String(index + 1),
    label: `门店${index + 1}`,
  })),
  { value: '14', label: '新店1' },
  { value: '15', label: '新店2' },
]

export const PERIOD_OPTIONS: Option[] = [
  { value: '2025-09', label: '2025-09（2025 年 9 月）' },
  { value: '2025-08', label: '2025-08（2025 年 8 月，未导入）' },
]

export const MODE_OPTIONS: Option[] = [
  { value: 'month', label: '当月' },
  { value: 'ytd', label: '累计' },
]

export const BASELINE_OPTIONS: Option[] = [
  { value: 'yoy', label: '同期' },
  { value: 'budget', label: '预算' },
  { value: 'mom', label: '上期' },
]

export function optionLabel(options: Option[], value: string): string {
  return options.find((item) => item.value === value)?.label ?? value
}

export function storeLabel(value: string): string {
  return optionLabel(STORE_OPTIONS, value)
}

export function baselineLabel(value: string): string {
  return optionLabel(BASELINE_OPTIONS, value)
}
