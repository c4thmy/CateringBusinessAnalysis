import { Table } from 'antd'
import type { TableColumnsType } from 'antd'
import type { ReactNode } from 'react'

export interface DataTableProps<T extends object> {
  columns: TableColumnsType<T>
  rows: T[]
  rowKey: (row: T) => string | number
  /** 行点击（下钻） */
  onRowClick?: (row: T) => void
  footer?: ReactNode
  size?: 'small' | 'middle' | 'large'
  loading?: boolean
  scrollX?: number
  pageSize?: number
  emptyText?: string
  rowClassName?: (row: T) => string
}

/**
 * 表格基座：排序 + 行点击下钻 + 合计行。
 * 表格数字使用统一 format 工具（万元 2 位 / 百分比 1 位 / pp 2 位 / 缺失「—」）。
 */
export function DataTable<T extends object>({
  columns,
  rows,
  rowKey,
  onRowClick,
  footer,
  size = 'small',
  loading = false,
  scrollX,
  pageSize,
  emptyText = '暂无数据',
  rowClassName,
}: DataTableProps<T>) {
  return (
    <Table<T>
      columns={columns}
      dataSource={rows}
      rowKey={(record) => rowKey(record)}
      rowClassName={rowClassName ? (record) => rowClassName(record) : undefined}
      size={size}
      loading={loading}
      pagination={
        pageSize
          ? { pageSize, size: 'small', showSizeChanger: false, hideOnSinglePage: rows.length <= pageSize }
          : false
      }
      scroll={scrollX ? { x: scrollX } : undefined}
      onRow={
        onRowClick
          ? (record) => ({
              onClick: () => onRowClick(record),
              style: { cursor: 'pointer' },
            })
          : undefined
      }
      footer={footer ? () => <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 24 }}>{footer}</div> : undefined}
      locale={{ emptyText }}
    />
  )
}
