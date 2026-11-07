import { Button, Card, Tag } from 'antd'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { color } from '../theme'
import { ArrowLeftIcon } from './icons'

export interface SkeletonPageProps {
  title: string
  subtitle?: string
  icon?: ReactNode
  description: ReactNode
  /** 该模块已规划的核心分析项 */
  planned: string[]
  /** 布局示意 / 占位内容 */
  preview?: ReactNode
  backTo?: string
  backText?: string
  note?: ReactNode
}

/**
 * 骨架页（一期）：标题 +「一期为框架展示，二期开放」+ 规划能力清单 + 返回收入分析入口。
 * 六个二期模块统一复用，避免各写一套。
 */
export function SkeletonPage({
  title,
  subtitle = '一期为框架展示，二期开放',
  icon,
  description,
  planned,
  preview,
  backTo = '/revenue/structure',
  backText = '返回收入分析',
  note,
}: SkeletonPageProps) {
  const navigate = useNavigate()

  return (
    <div className="page-stack">
      <Card className="data-card" styles={{ body: { padding: 20 } }}>
        <div className="skeleton-hero">
          {icon ? <span className="skeleton-hero-icon">{icon}</span> : null}
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 18, fontWeight: 600 }}>{title}</span>
              <Tag color="blue">{subtitle}</Tag>
            </div>
            <div style={{ marginTop: 6, fontSize: 13, lineHeight: 1.8, color: color.textSecondary }}>
              {description}
            </div>
          </div>
        </div>
      </Card>

      <Card
        className="data-card"
        title="已规划的核心分析项"
        styles={{ body: { padding: 16 } }}
      >
        <div className="planned-grid">
          {planned.map((item, index) => (
            <div className="planned-item" key={item}>
              <span className="planned-item-index">{index + 1}</span>
              <span>{item}</span>
            </div>
          ))}
        </div>
      </Card>

      {preview}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <Button icon={<ArrowLeftIcon />} onClick={() => navigate(backTo)}>
          {backText}
        </Button>
        <span className="page-footnote" style={{ margin: 0, padding: '6px 12px' }}>
          {note ?? '一期只开放登录、应用框架、数据导入、经营总览、营业利润对比与收入分析全链路；本模块二期随规格实现。'}
        </span>
      </div>
    </div>
  )
}
