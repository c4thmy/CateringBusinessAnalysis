import { useQueryClient } from '@tanstack/react-query'
import { Button, Segmented, Select } from 'antd'
import { useState } from 'react'
import type { PeriodMode } from '../api/types'
import {
  BASELINE_OPTIONS,
  BRAND_OPTIONS,
  MODE_OPTIONS,
  PERIOD_OPTIONS,
  STORE_OPTIONS,
} from '../config/filters'
import { useFilters } from '../filters/FilterContext'

/**
 * 全局筛选：品牌 / 门店 / 期间 / 当月·累计 / 对比基准。
 * 所有筛选值写入 URL（刷新后保留），所有分析模块共用同一组筛选值。
 */
export function FilterBar() {
  const { filters, setFilters } = useFilters()
  const queryClient = useQueryClient()
  const [refreshing, setRefreshing] = useState(false)

  const refresh = async () => {
    setRefreshing(true)
    try {
      await queryClient.invalidateQueries()
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div className="app-filter-bar">
      <Select
        size="small"
        aria-label="品牌"
        value={filters.brand}
        options={BRAND_OPTIONS}
        onChange={(value) => setFilters({ brand: value })}
        style={{ width: 130 }}
        title="品牌"
      />
      <Select
        size="small"
        aria-label="门店"
        value={filters.store}
        options={STORE_OPTIONS}
        showSearch
        optionFilterProp="label"
        onChange={(value) => setFilters({ store: value })}
        style={{ width: 132 }}
        title="门店"
      />
      <Select
        size="small"
        aria-label="期间"
        value={filters.period}
        options={PERIOD_OPTIONS}
        onChange={(value) => setFilters({ period: value })}
        style={{ width: 196 }}
        title="期间"
      />
      <Segmented
        size="small"
        options={MODE_OPTIONS}
        value={filters.mode}
        onChange={(value) => setFilters({ mode: String(value) as PeriodMode })}
        title="口径：当月 / 累计"
      />
      <span className="app-filter-label">对比</span>
      <Select
        size="small"
        aria-label="对比基准"
        value={filters.baseline}
        options={BASELINE_OPTIONS}
        onChange={(value) => setFilters({ baseline: value as 'yoy' | 'budget' | 'mom' })}
        style={{ width: 92 }}
        title="对比基准：同期 / 预算 / 上期（预算与上期为二期）"
      />
      <Button size="small" onClick={() => void refresh()} loading={refreshing}>
        刷新
      </Button>
    </div>
  )
}
