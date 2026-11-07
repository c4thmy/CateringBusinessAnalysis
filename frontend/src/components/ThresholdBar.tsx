import { Tag } from 'antd'
import { formatNumber, formatPercent } from '../utils/format'
import { color } from '../theme'

export type ThresholdDirection = 'max' | 'min'

export interface ThresholdBarProps {
  label: string
  value: number | null
  format: 'percent' | 'number'
  threshold: number
  /** max = 不能超过阈值（费用率）；min = 不能低于阈值（ROI） */
  direction: ThresholdDirection
  status?: 'ok' | 'warning' | 'risk'
  /** 进度条坐标轴上限 */
  domainMax?: number
  unit?: string
  note?: string
}

const STATUS_META: Record<NonNullable<ThresholdBarProps['status']>, { color: string; text: string }> = {
  ok: { color: 'green', text: '达标' },
  warning: { color: 'orange', text: '未达标' },
  risk: { color: 'red', text: '风险' },
}

function formatValue(value: number | null, format: 'percent' | 'number'): string {
  if (value === null) return '—'
  return format === 'percent' ? formatPercent(value) : formatNumber(value, 2)
}

/** 阈值线进度条：费用率 / 毛利 ROI / 销售 ROI 与阈值对比 */
export function ThresholdBar({
  label,
  value,
  format,
  threshold,
  direction,
  status,
  domainMax,
  unit,
  note,
}: ThresholdBarProps) {
  const max = domainMax ?? Math.max(threshold, value ?? 0) * 1.6
  const width = value === null || max <= 0 ? 0 : Math.min(Math.max(value / max, 0), 1) * 100
  const marker = max > 0 ? Math.min(Math.max(threshold / max, 0), 1) * 100 : 0
  const meta = status ? STATUS_META[status] : null
  const thresholdText = `${direction === 'max' ? '≤' : '≥'} ${formatValue(threshold, format)}`

  return (
    <div className="threshold-row">
      <div className="threshold-head">
        <span>
          {label}
          {unit ? <span style={{ color: color.textTertiary }}>（{unit}）</span> : null}
        </span>
        {meta ? (
          <Tag color={meta.color} style={{ marginInlineEnd: 0 }}>
            {meta.text}
          </Tag>
        ) : null}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span className="threshold-value">{formatValue(value, format)}</span>
        <span className="threshold-note">阈值 {thresholdText}</span>
      </div>
      <div className="threshold-track">
        <div
          className="threshold-fill"
          style={{
            width: `${width}%`,
            background: meta?.color === 'red' ? color.negative : meta?.color === 'orange' ? color.warning : color.primary,
          }}
        />
        <div className="threshold-marker" style={{ left: `calc(${marker}% - 1px)` }} title={`阈值 ${thresholdText}`} />
      </div>
      {note ? <span className="threshold-note">{note}</span> : null}
    </div>
  )
}
