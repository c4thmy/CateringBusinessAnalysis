import { Button, Popover, Tag } from 'antd'
import type { Insight } from '../api/types'
import { SparkleIcon } from './icons'

const LEVEL_TAG: Record<Insight['level'], { color: string; text: string }> = {
  positive: { color: 'green', text: '正向' },
  negative: { color: 'red', text: '负向' },
  info: { color: 'blue', text: '中性' },
}

export interface InsightPopoverProps {
  insights: Insight[]
  title?: string
  buttonText?: string
}

/** 卡片右上角「洞察」按钮：展示规则生成的文字结论与证据（design.md 第 15 节） */
export function InsightPopover({ insights, title = '规则化洞察', buttonText = '洞察' }: InsightPopoverProps) {
  if (insights.length === 0) return null

  const content = (
    <div style={{ maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 12, color: '#9CA3AF' }}>
        {title}：按影响绝对值排序取前 3（规则生成，暂不接大模型）
      </div>
      {insights.map((item) => {
        const tag = LEVEL_TAG[item.level]
        return (
          <div className="ai-insight-item" key={`${item.title}-${item.evidence}`}>
            <div className="ai-insight-title">
              <Tag color={tag.color} style={{ marginInlineEnd: 6 }}>
                {tag.text}
              </Tag>
              {item.title}
            </div>
            <div className="ai-insight-text">{item.text}</div>
            <div className="ai-insight-evidence">证据：{item.evidence}</div>
          </div>
        )
      })}
    </div>
  )

  return (
    <Popover content={content} title={null} trigger="click" placement="bottomRight" arrow={false}>
      <Button type="text" size="small" icon={<SparkleIcon />} style={{ paddingInline: 6 }}>
        {buttonText}
      </Button>
    </Popover>
  )
}
