import { Alert, Drawer, Tag } from 'antd'
import { useState } from 'react'
import { useOverview } from '../api/hooks'
import { useFilters } from '../filters/FilterContext'

const LEVEL_TAG: Record<string, { color: string; text: string }> = {
  positive: { color: 'green', text: '正向' },
  negative: { color: 'red', text: '负向' },
  info: { color: 'blue', text: '中性' },
}

/** 右下角 AI 洞察悬浮按钮：展示当前期间的规则化洞察（暂不接大模型） */
export function AiAssistantFab() {
  const { filters } = useFilters()
  const [open, setOpen] = useState(false)
  const { data } = useOverview(filters)
  const insights = data?.insights ?? []

  return (
    <>
      <button
        type="button"
        className="ai-fab"
        aria-label="打开 AI 洞察（规则版）"
        onClick={() => setOpen(true)}
      >
        <span className="ai-fab-icon" aria-hidden="true">
          ✦
        </span>
        <span>AI</span>
      </button>

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        size={420}
        title="AI 洞察（规则版）"
        styles={{ body: { padding: 16 } }}
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          title="规则化洞察，暂不接大模型"
          description="结论由利润桥、收入结构、同店、渠道、产品等规则函数生成，按影响绝对值排序取前 3，并附证据位置。"
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {insights.map((item) => {
            const tag = LEVEL_TAG[item.level] ?? LEVEL_TAG.info
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
          {insights.length === 0 ? (
            <div className="kpi-hint">当前筛选下暂无洞察：请先加载示例数据或切换回 2025-09。</div>
          ) : null}
        </div>
        <div style={{ marginTop: 16, fontSize: 12, color: '#9CA3AF', lineHeight: 1.8 }}>
          每个分析卡片右上角的「洞察」按钮展示该卡片的因素结论；本面板汇总当前期间总览洞察。
        </div>
      </Drawer>
    </>
  )
}
