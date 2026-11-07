import { Alert, Space } from 'antd'
import { useFilters } from '../filters/FilterContext'

export type ScopeKind = 'dashboard' | 'profit' | 'revenue'

/**
 * 全局筛选的范围提示：
 * - 累计口径只在一期总览与营业利润页开放；
 * - 预算 / 上期基准为二期导入范围；
 * - 单店视角暂无门店级数据。
 */
export function ScopeNotice({ kind }: { kind: ScopeKind }) {
  const { filters } = useFilters()
  const items: { key: string; message: string; description: string; type: 'info' | 'warning' }[] = []

  if (filters.baseline !== 'yoy') {
    items.push({
      key: 'baseline',
      type: 'warning',
      message: '当前仅同期基准可用',
      description:
        '预算 / 上期基准的数据集属于二期导入范围，本页暂按同期（yoy）展示；筛选值已写入 URL，刷新后保留。',
    })
  }

  if (filters.mode === 'ytd' && kind === 'revenue') {
    items.push({
      key: 'mode',
      type: 'info',
      message: '累计口径暂不支持收入分析',
      description: '一期累计口径只在经营总览与营业利润页开放，收入分析按当月（2025-09）展示。',
    })
  }

  if (filters.store !== 'all') {
    items.push({
      key: 'store',
      type: 'warning',
      message: '单店视角暂不可用',
      description:
        '一期示例数据只提供品牌合计，门店级结构分析二期开放；当前展示品牌口径，可到「同店异动」点击门店行下钻单店详情。',
    })
  }

  if (items.length === 0) return null

  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      {items.map((item) => (
        <Alert
          key={item.key}
          type={item.type}
          showIcon
          title={item.message}
          description={item.description}
        />
      ))}
    </Space>
  )
}
