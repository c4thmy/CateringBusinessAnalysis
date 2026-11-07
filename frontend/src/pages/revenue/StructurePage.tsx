import { Card, Tag } from 'antd'
import type { TableColumnsType } from 'antd'
import { useState } from 'react'
import { useStructure } from '../../api/hooks'
import type { StructureDimension, StructureRow } from '../../api/types'
import { BarChart } from '../../components/BarChart'
import { CaliberNote, Footnote } from '../../components/Notes'
import { ChangeTag } from '../../components/ChangeTag'
import { ChartCard } from '../../components/ChartCard'
import { DataTable } from '../../components/DataTable'
import { PageError, PageLoading } from '../../components/PageState'
import { ScopeNotice } from '../../components/ScopeNotice'
import { useFilters } from '../../filters/FilterContext'
import { formatPercent, formatWan } from '../../utils/format'
import { color } from '../../theme'

const DIMENSIONS: { value: StructureDimension; label: string }[] = [
  { value: 'business_model', label: '经营模式' },
  { value: 'store_type', label: '同店新店' },
  { value: 'region', label: '区域' },
  { value: 'channel', label: '渠道' },
  { value: 'channel_category', label: '渠道大类' },
  { value: 'series', label: '系列' },
]

const columns: TableColumnsType<StructureRow> = [
  {
    title: '维度值',
    dataIndex: 'name',
    key: 'name',
    width: 180,
    render: (value: string) => <b style={{ fontWeight: 500 }}>{value}</b>,
  },
  {
    title: '本期（万元）',
    dataIndex: 'current',
    key: 'current',
    align: 'right',
    width: 120,
    sorter: (a, b) => a.current - b.current,
    render: (value: number) => formatWan(value),
  },
  {
    title: '本期占比',
    dataIndex: 'current_share',
    key: 'current_share',
    align: 'right',
    width: 100,
    render: (value: number | null) => formatPercent(value),
  },
  {
    title: '同期（万元）',
    dataIndex: 'base',
    key: 'base',
    align: 'right',
    width: 116,
    render: (value: number) => formatWan(value),
  },
  {
    title: '同期占比',
    dataIndex: 'base_share',
    key: 'base_share',
    align: 'right',
    width: 100,
    render: (value: number | null) => formatPercent(value),
  },
  {
    title: '同比差额（万元）',
    dataIndex: 'diff',
    key: 'diff',
    align: 'right',
    width: 140,
    sorter: (a, b) => a.diff - b.diff,
    render: (_value, row) => <ChangeTag diff={row.diff} format="currency" goodDirection="up" />,
  },
  {
    title: '增减率',
    dataIndex: 'rate',
    key: 'rate',
    align: 'right',
    width: 110,
    render: (_value, row) => <ChangeTag diff={row.rate} format="percent" goodDirection="up" />,
  },
]

export function StructurePage() {
  const { filters } = useFilters()
  const [dimension, setDimension] = useState<StructureDimension>('channel')
  const query = useStructure(filters, dimension)

  if (query.isLoading) return <PageLoading />
  if (query.isError || !query.data) {
    return <PageError error={query.error} onRetry={() => void query.refetch()} />
  }

  const { data, insights } = query.data
  const dimensionLabel = DIMENSIONS.find((item) => item.value === dimension)?.label ?? data.dimension_name

  return (
    <div className="page-stack">
      <ScopeNotice kind="revenue" />

      <ChartCard
        title="收入结构对比"
        subtitle={`${dimensionLabel}维度 · 本期 vs 同期 · 单位：万元`}
        segmented={{
          options: DIMENSIONS.map((item) => ({ label: item.label, value: item.value })),
          value: dimension,
          onChange: (value: string) => setDimension(value as StructureDimension),
        }}
        insights={insights}
        footer={
          <CaliberNote title="口径说明">
            {data.caliber_note} 6 个维度的分项之和均等于该口径总收入，本页合计{' '}
            {formatWan(data.total.current)} 万元（同期 {formatWan(data.total.base)} 万元，同比{' '}
            <ChangeTag diff={data.total.diff} format="currency" goodDirection="up" />）。
          </CaliberNote>
        }
      >
        <BarChart
          horizontal
          categories={data.rows.map((row) => row.name)}
          series={[
            { name: '本期', values: data.rows.map((row) => row.current), color: color.primary },
            { name: '同期', values: data.rows.map((row) => row.base), color: color.chartComparison },
          ]}
          valueFormatter={(value) => formatWan(value)}
          unit="万元"
          height={Math.max(280, data.rows.length * 34 + 60)}
        />
      </ChartCard>

      <Card
        title={`${dimensionLabel}结构表`}
        extra={<Tag color="blue">分项之和 = 合计</Tag>}
        styles={{ body: { padding: 0 } }}
      >
        <DataTable<StructureRow>
          columns={columns}
          rows={data.rows}
          rowKey={(row) => row.key}
          scrollX={900}
          footer={
            <>
              <span>
                合计 <b>{formatWan(data.total.current)}</b> 万元
              </span>
              <span style={{ color: '#6B7280' }}>同期 {formatWan(data.total.base)} 万元</span>
              <ChangeTag diff={data.total.diff} format="currency" goodDirection="up" />
              <ChangeTag diff={data.total.rate} format="percent" goodDirection="up" />
            </>
          }
        />
        <div style={{ padding: '0 16px 16px' }}>
          <CaliberNote title="增量贡献">
            {data.rows
              .filter((row) => row.diff !== 0)
              .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
              .slice(0, 3)
              .map(
                (row) =>
                  `${row.name} ${row.diff > 0 ? '+' : ''}${formatWan(row.diff)} 万元（${formatPercent(row.rate)}）`,
              )
              .join('；')}
            。{dimension === 'business_model' ? '经营模式为演示占位分摊，接入门店维度后以导入数据为准。' : ''}
          </CaliberNote>
        </div>
      </Card>

      <Footnote title="数据来源与口径">
        本页合计与四套口径的关系：利润表口径 1,000.00 / 760.00（总览、利润桥、毛利率）；渠道口径 1,000.00 / 759.56（本页渠道、渠道大类维度）；
        门店口径 1,000.23 / 759.95（经营模式、同店新店、区域维度）；品类口径 1,000.16 / 760.00（系列维度）。
        差异 0.05–0.23 万元来自源表取整与汇总范围不同，系统不强行对齐、不改写源数字。
      </Footnote>
    </div>
  )
}
