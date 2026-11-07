import { Card, Skeleton } from 'antd'
import type { ReactNode } from 'react'
import type { Insight, Percentile } from '../api/types'
import type { DeltaFormat } from '../utils/format'
import { formatNumber, formatPercent } from '../utils/format'
import type { GoodDirection, MetricKey } from '../utils/metrics'
import { getMetric } from '../utils/metrics'
import { ChangeTag } from './ChangeTag'
import { InsightPopover } from './InsightPopover'

export type KpiValueFormat = 'currency' | 'percent' | 'number' | 'count'

export interface KpiCardProps {
  title: string
  /** 指标 key：用于取好坏方向与默认格式（见 utils/metrics.ts） */
  metric?: MetricKey | string
  value: number | null
  valueFormat?: KpiValueFormat
  unit?: string
  /** 对比值（同期 / 预算 / 上期） */
  base?: number | null
  baseLabel?: string
  diff?: number | null
  diffFormat?: DeltaFormat
  goodDirection?: GoodDirection
  /** 门店分位；门店数 < 3 时不展示分位行 */
  percentiles?: Percentile | null
  storeCount?: number
  percentileHint?: string
  percentileFormat?: KpiValueFormat
  footer?: ReactNode
  insights?: Insight[]
  loading?: boolean
  /** 大数字的 tooltip（展示源表精度） */
  valueTitle?: string
}

function formatBy(value: number | null | undefined, format: KpiValueFormat): string {
  if (format === 'percent') return formatPercent(value)
  if (format === 'count') return formatNumber(value, 2)
  if (format === 'number') return formatNumber(value, 2)
  return formatNumber(value, 2)
}

function defaultFormatOf(metric: string | undefined): KpiValueFormat | null {
  const meta = metric ? getMetric(metric) : null
  if (!meta) return null
  if (meta.format === 'percent') return 'percent'
  if (meta.format === 'count') return 'count'
  if (meta.format === 'number') return 'number'
  return 'currency'
}

/**
 * KPI 卡片：指标名 + 大数字 + 单位 + 对比值 + 差异（箭头/正负号/语义色）
 * + P25/P50/P75 分位行 + 门店不足提示 + 洞察入口。
 */
export function KpiCard({
  title,
  metric,
  value,
  valueFormat,
  unit,
  base,
  baseLabel = '同期',
  diff,
  diffFormat,
  goodDirection,
  percentiles,
  storeCount,
  percentileHint,
  percentileFormat,
  footer,
  insights,
  loading,
  valueTitle,
}: KpiCardProps) {
  const meta = metric ? getMetric(metric) : null
  const resolvedValueFormat: KpiValueFormat = valueFormat ?? defaultFormatOf(metric) ?? 'currency'
  const resolvedDiffFormat: DeltaFormat =
    diffFormat ?? (meta?.deltaFormat as DeltaFormat | undefined) ?? 'currency'
  const resolvedDirection: GoodDirection = goodDirection ?? meta?.goodDirection ?? 'up'
  const unitText = unit ?? meta?.unit ?? ''

  const valueText = formatBy(value, resolvedValueFormat)
  const baseText = formatBy(base, resolvedValueFormat)
  const percentileValueFormat: KpiValueFormat =
    percentileFormat ?? (resolvedValueFormat === 'percent' ? 'percent' : resolvedValueFormat)

  const insufficientStores = storeCount !== undefined && storeCount < 3
  const showPercentiles = !insufficientStores && percentiles !== null && percentiles !== undefined
  const showHint = !insufficientStores && !showPercentiles && percentileHint !== undefined

  return (
    <Card className="kpi-card" styles={{ body: { padding: 16 } }}>
      {loading ? (
        <Skeleton active paragraph={{ rows: 2 }} title={{ width: '40%' }} />
      ) : (
        <>
          <div className="kpi-head">
            <span className="kpi-title">{title}</span>
            {insights && insights.length > 0 ? <InsightPopover insights={insights} title={`${title}洞察`} /> : null}
          </div>

          <div className="kpi-value-row">
            <span className="kpi-value" title={valueTitle ?? (value === null ? '暂无数据' : valueText)}>
              {valueText}
            </span>
            {unitText ? <span className="kpi-unit">{unitText}</span> : null}
          </div>

          {(base !== null && base !== undefined) || (diff !== null && diff !== undefined) ? (
            <div className="kpi-compare">
              <span>
                {baseLabel} <span className="kpi-compare-value">{baseText}</span>
              </span>
              {diff !== null && diff !== undefined ? (
                <>
                  <span aria-hidden="true">·</span>
                  <ChangeTag diff={diff} format={resolvedDiffFormat} goodDirection={resolvedDirection} />
                </>
              ) : null}
            </div>
          ) : null}

          {showPercentiles ? (
            <div className="kpi-percentiles" title="门店间分位（P25 / P50 / P75）与本期值">
              <span className="kpi-pct-item">
                <b>P25</b>
                {formatBy(percentiles.p25, percentileValueFormat)}
              </span>
              <span className="kpi-pct-item">
                <b>P50</b>
                {formatBy(percentiles.p50, percentileValueFormat)}
              </span>
              <span className="kpi-pct-item">
                <b>P75</b>
                {formatBy(percentiles.p75, percentileValueFormat)}
              </span>
              {percentiles.current !== null ? (
                <span className="kpi-current">
                  本店 {formatBy(percentiles.current, percentileValueFormat)}
                  {percentiles.bucket ? ` · ${percentiles.bucket}` : ''}
                </span>
              ) : null}
            </div>
          ) : null}

          {insufficientStores ? (
            <div className="kpi-hint" data-testid="kpi-percentile-hint">
              门店数不足，无法计算分位
            </div>
          ) : null}

          {showHint ? (
            <div className="kpi-hint" data-testid="kpi-percentile-hint">
              {percentileHint}
            </div>
          ) : null}

          {footer ? <div className="kpi-footer">{footer}</div> : null}
        </>
      )}
    </Card>
  )
}
