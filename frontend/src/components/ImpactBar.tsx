import type { ReactNode } from 'react'
import { formatNumber, formatPercent, formatSignedNumber } from '../utils/format'
import { color } from '../theme'

export interface ImpactBarItem {
  key: string
  label: string
  value: number
  color: string
}

export interface ImpactBarProps {
  items: ImpactBarItem[]
  /** 与收入变动合计对比的尾差说明 */
  totalDiff?: number
  note?: ReactNode
  unit?: string
}

/**
 * 异动拆解条：把收入变动拆成客流 / 客单（或新店 / 同店客流 / 同店客单 / 闭店）的横向占比条。
 * 数值同时以文字给出，避免只靠颜色区分。
 */
export function ImpactBar({ items, totalDiff, note, unit = '万元' }: ImpactBarProps) {
  const sumAbs = items.reduce((sum, item) => sum + Math.abs(item.value), 0)

  return (
    <div className="impact-bar">
      <div className="impact-bar-track" role="img" aria-label="收入变动拆解条">
        {items.map((item) => {
          const width = sumAbs > 0 ? (Math.abs(item.value) / sumAbs) * 100 : 100 / items.length
          return (
            <div
              key={item.key}
              className="impact-bar-seg"
              style={{ width: `${width}%`, background: item.color }}
              title={`${item.label} ${formatSignedNumber(item.value)} ${unit}`}
            >
              {width >= 18 ? `${formatSignedNumber(item.value)}` : ''}
            </div>
          )
        })}
      </div>

      <div className="impact-bar-legend">
        {items.map((item) => (
          <span className="impact-legend-item" key={item.key}>
            <span className="impact-legend-swatch" style={{ background: item.color }} />
            {item.label}
            <b className="semantic-positive" style={{ color: item.value >= 0 ? color.positive : color.negative }}>
              {formatSignedNumber(item.value)} {unit}
            </b>
            {sumAbs > 0 ? (
              <span style={{ color: color.textTertiary }}>
                （{formatPercent(Math.abs(item.value) / sumAbs, 1)}）
              </span>
            ) : null}
          </span>
        ))}
        {totalDiff !== undefined ? (
          <span style={{ color: color.textTertiary }}>
            收入变动合计 {formatNumber(totalDiff)} {unit}
          </span>
        ) : null}
      </div>

      {note ? <div className="caliber-note">{note}</div> : null}
    </div>
  )
}
