import type { GoodDirection, Semantic } from '../utils/metrics'
import { semanticClass, semanticFromDiff, semanticLabel } from '../utils/metrics'
import type { DeltaFormat } from '../utils/format'
import { formatDelta } from '../utils/format'

export interface ChangeTagProps {
  diff: number | null | undefined
  /** 差异格式：金额 2 位 / 比率 1 位 / pp 2 位 / 计数 0 位 */
  format?: DeltaFormat
  /** 指标好坏方向：成本类指标「越低越好」 */
  goodDirection?: GoodDirection
  /** 追加在差异后面的单位（列头已带单位时可省略） */
  suffix?: string
  title?: string
  className?: string
}

/**
 * 差异展示：颜色 + ↑/↓ + 正负号，三者同时具备（色弱友好）。
 * 语义由「指标好坏方向」决定，不能只看数值正负。
 */
export function ChangeTag({
  diff,
  format = 'number',
  goodDirection = 'up',
  suffix,
  title,
  className,
}: ChangeTagProps) {
  const semantic: Semantic = semanticFromDiff(diff, goodDirection)
  const text = formatDelta(diff, format)
  return (
    <span
      className={['delta', semanticClass(semantic), className].filter(Boolean).join(' ')}
      title={title ?? `${semanticLabel(semantic)}：${text}`}
      data-semantic={semantic}
    >
      {text}
      {suffix ?? ''}
    </span>
  )
}
