import { Card, Empty } from 'antd'
import type { ReactNode } from 'react'

export interface EmptyStateProps {
  title?: string
  description?: ReactNode
  action?: ReactNode
}

/** 空态：缺数据 / 期间未导入时统一使用，禁止用 0 冒充缺失值 */
export function EmptyState({ title = '暂无数据', description, action }: EmptyStateProps) {
  return (
    <Card className="data-card" styles={{ body: { padding: '32px 16px' } }}>
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={
          <div style={{ maxWidth: 560, margin: '0 auto' }}>
            <div style={{ fontWeight: 600, color: '#1F2430', marginBottom: 6 }}>{title}</div>
            {description ? (
              <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.8 }}>{description}</div>
            ) : null}
          </div>
        }
      >
        {action}
      </Empty>
    </Card>
  )
}
