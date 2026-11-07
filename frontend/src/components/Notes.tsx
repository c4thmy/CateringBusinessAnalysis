import type { ReactNode } from 'react'

/** 页面脚注：数据来源、口径、尾差说明（所有分析页必须交代数字来源） */
export function Footnote({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <div className="page-footnote">
      {title ? <strong>{title}：</strong> : null}
      {children}
    </div>
  )
}

/** 口径说明条：渠道分摊口径、四套收入合计差异等 */
export function CaliberNote({ children, title = '口径说明' }: { children: ReactNode; title?: string }) {
  return (
    <div className="caliber-note">
      <strong style={{ color: '#6B7280' }}>{title}：</strong>
      {children}
    </div>
  )
}
