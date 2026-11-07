import type { TableColumnsType } from 'antd'
import { Tag } from 'antd'
import type { BridgeItem } from '../api/types'
import { ChangeTag } from './ChangeTag'
import { DataTable } from './DataTable'

const factorColumns: TableColumnsType<BridgeItem> = [
  { title: '因素', dataIndex: 'name', key: 'name', width: 140 },
  {
    title: '影响额（万元）',
    dataIndex: 'impact',
    key: 'impact',
    align: 'right',
    width: 130,
    sorter: (a, b) => a.impact - b.impact,
    render: (_value, row) => <ChangeTag diff={row.impact} format="currency" goodDirection="up" />,
  },
  {
    title: '方向',
    key: 'kind',
    width: 96,
    render: (_value, row) => (
      <Tag color={row.impact >= 0 ? 'green' : 'red'}>{row.impact >= 0 ? '正向 ↑' : '负向 ↓'}</Tag>
    ),
  },
  { title: '计算说明', dataIndex: 'note', key: 'note' },
]

/** 利润桥因素表（瀑布图的分段器视图），总览与营业利润页共用 */
export function FactorTable({ items }: { items: BridgeItem[] }) {
  return <DataTable<BridgeItem> columns={factorColumns} rows={items} rowKey={(row) => row.key} />
}
