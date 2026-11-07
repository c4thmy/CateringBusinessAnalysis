import { Card, Segmented, Skeleton } from 'antd'
import type { ReactNode } from 'react'
import type { Insight } from '../api/types'
import { InsightPopover } from './InsightPopover'

export interface SegmentedConfig {
  options: { label: string; value: string }[]
  value: string
  onChange: (value: string) => void
}

export interface ChartCardProps {
  title: string
  subtitle?: ReactNode
  /** 右上角自定义工具（分段器、下拉等） */
  extra?: ReactNode
  /** 卡片内分段选择器（营收/客单价/... 或 图/表） */
  segmented?: SegmentedConfig
  insights?: Insight[]
  footer?: ReactNode
  loading?: boolean
  children: ReactNode
}

/** 图表卡片：标题 + 右上角「洞察」 + 分段器 + 内容 + 脚注 */
export function ChartCard({
  title,
  subtitle,
  extra,
  segmented,
  insights,
  footer,
  loading,
  children,
}: ChartCardProps) {
  return (
    <Card className="data-card" styles={{ body: { padding: 16 } }}>
      <div className="card-head">
        <div className="card-head-main">
          <div className="card-head-title">{title}</div>
          {subtitle ? <div className="card-head-sub">{subtitle}</div> : null}
        </div>
        <div className="card-tools">
          {extra}
          {insights && insights.length > 0 ? <InsightPopover insights={insights} title={`${title}洞察`} /> : null}
        </div>
      </div>

      {segmented ? (
        <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'flex-end' }}>
          <Segmented
            size="small"
            options={segmented.options}
            value={segmented.value}
            onChange={(value) => segmented.onChange(String(value))}
          />
        </div>
      ) : null}

      {loading ? <Skeleton active paragraph={{ rows: 6 }} /> : children}

      {footer ? <div style={{ marginTop: 12 }}>{footer}</div> : null}
    </Card>
  )
}
