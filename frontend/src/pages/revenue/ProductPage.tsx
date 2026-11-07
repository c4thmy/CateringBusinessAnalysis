import { Card, Col, Row, Tag } from 'antd'
import type { TableColumnsType } from 'antd'
import { useState } from 'react'
import { useProduct } from '../../api/hooks'
import type { ProductItemRow, SeriesRow } from '../../api/types'
import { BarChart } from '../../components/BarChart'
import { ChangeTag } from '../../components/ChangeTag'
import { ChartCard } from '../../components/ChartCard'
import { DataTable } from '../../components/DataTable'
import { CaliberNote, Footnote } from '../../components/Notes'
import { PageError, PageLoading } from '../../components/PageState'
import { ScopeNotice } from '../../components/ScopeNotice'
import { useFilters } from '../../filters/FilterContext'
import { color } from '../../theme'
import {
  formatNumber,
  formatPercent,
  formatSignedNumber,
  formatTicket,
  formatWan,
} from '../../utils/format'

const seriesColumns: TableColumnsType<SeriesRow> = [
  {
    title: '系列',
    dataIndex: 'name',
    key: 'name',
    width: 110,
    fixed: 'left',
    render: (value: string) => <b style={{ fontWeight: 500 }}>{value}</b>,
  },
  {
    title: '本期销量',
    key: 'qty_current',
    align: 'right',
    width: 120,
    sorter: (a, b) => a.qty.current - b.qty.current,
    render: (_value, row) => formatNumber(row.qty.current, 2),
  },
  {
    title: '本期单价（元）',
    key: 'price_current',
    align: 'right',
    width: 126,
    render: (_value, row) => formatTicket(row.price.current),
  },
  {
    title: '本期收入（万元）',
    key: 'revenue_current',
    align: 'right',
    width: 136,
    render: (_value, row) => formatWan(row.revenue.current),
  },
  {
    title: '同期销量',
    key: 'qty_base',
    align: 'right',
    width: 120,
    render: (_value, row) => formatNumber(row.qty.base, 2),
  },
  {
    title: '同期单价（元）',
    key: 'price_base',
    align: 'right',
    width: 126,
    render: (_value, row) => formatTicket(row.price.base),
  },
  {
    title: '同期收入（万元）',
    key: 'revenue_base',
    align: 'right',
    width: 136,
    render: (_value, row) => formatWan(row.revenue.base),
  },
  {
    title: '销量影响（万元）',
    dataIndex: 'qty_impact',
    key: 'qty_impact',
    align: 'right',
    width: 136,
    sorter: (a, b) => a.qty_impact - b.qty_impact,
    render: (_value, row) => <ChangeTag diff={row.qty_impact} format="currency" goodDirection="up" />,
  },
  {
    title: '单价影响（万元）',
    dataIndex: 'price_impact',
    key: 'price_impact',
    align: 'right',
    width: 136,
    sorter: (a, b) => a.price_impact - b.price_impact,
    render: (_value, row) => <ChangeTag diff={row.price_impact} format="currency" goodDirection="up" />,
  },
  {
    title: '影响合计（万元）',
    dataIndex: 'diff',
    key: 'diff',
    align: 'right',
    width: 136,
    sorter: (a, b) => a.diff - b.diff,
    render: (_value, row) => <ChangeTag diff={row.diff} format="currency" goodDirection="up" />,
  },
]

const rankColumns: TableColumnsType<SeriesRow> = [
  {
    title: '排名',
    key: 'rank',
    width: 64,
    align: 'center',
    render: (_value, _row, index) => (
      <span style={{ color: index < 3 ? color.primary : '#9CA3AF', fontWeight: index < 3 ? 600 : 400 }}>
        {index + 1}
      </span>
    ),
  },
  { title: '系列', dataIndex: 'name', key: 'name', width: 100 },
  {
    title: '影响合计（万元）',
    dataIndex: 'diff',
    key: 'diff',
    align: 'right',
    width: 140,
    render: (_value, row) => <ChangeTag diff={row.diff} format="currency" goodDirection="up" />,
  },
  {
    title: '销量影响',
    dataIndex: 'qty_impact',
    key: 'qty_impact',
    align: 'right',
    width: 120,
    render: (_value, row) => formatSignedNumber(row.qty_impact),
  },
  {
    title: '单价影响',
    dataIndex: 'price_impact',
    key: 'price_impact',
    align: 'right',
    width: 120,
    render: (_value, row) => formatSignedNumber(row.price_impact),
  },
]

interface SetCompareRow {
  key: string
  name: string
  base: number
  current: number
  diff: number
  kind: 'count' | 'yuan' | 'pp'
}

const setColumns: TableColumnsType<SetCompareRow> = [
  { title: '指标', dataIndex: 'name', key: 'name', width: 160 },
  {
    title: '2024-09',
    key: 'base',
    align: 'right',
    width: 150,
    render: (_value, row) => (row.kind === 'pp' ? formatPercent(row.base) : formatNumber(row.base, row.kind === 'count' ? 0 : 2)),
  },
  {
    title: '2025-09',
    key: 'current',
    align: 'right',
    width: 160,
    render: (_value, row) => (row.kind === 'pp' ? formatPercent(row.current) : formatNumber(row.current, row.kind === 'count' ? 0 : 2)),
  },
  {
    title: '同比',
    key: 'diff',
    align: 'right',
    width: 160,
    render: (_value, row) => (
      <ChangeTag
        diff={row.diff}
        format={row.kind === 'pp' ? 'pp' : row.kind === 'count' ? 'count' : 'currency'}
        goodDirection="up"
      />
    ),
  },
]

export function ProductPage() {
  const { filters } = useFilters()
  const [scope, setScope] = useState<'same_store' | 'all'>('same_store')
  const query = useProduct(filters, scope)

  if (query.isLoading) return <PageLoading />
  if (query.isError || !query.data) {
    return <PageError error={query.error} onRetry={() => void query.refetch()} />
  }

  const { data, insights } = query.data
  const sets = data.sets
  const sortedSeries = [...data.series].sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
  const items = data.items ?? []
  const sortedItems = [...items].sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff)).slice(0, 12)
  const itemColumns: TableColumnsType<ProductItemRow> = [
    { title: '产品', dataIndex: 'name', key: 'name' },
    { title: '类型', key: 'kind', width: 80, render: (_v, row) => <Tag color={row.is_set ? 'orange' : 'blue'}>{row.is_set ? '套餐' : '单品'}</Tag> },
    { title: '本期销量', key: 'qty_current', align: 'right', sorter: (a, b) => a.qty.current - b.qty.current, render: (_v, row) => formatNumber(row.qty.current, 0) },
    { title: '同期销量', key: 'qty_base', align: 'right', render: (_v, row) => formatNumber(row.qty.base, 0) },
    { title: '销量影响（万元）', key: 'qty_impact', align: 'right', sorter: (a, b) => a.qty_impact - b.qty_impact, render: (_v, row) => <span style={{ color: row.qty_impact >= 0 ? color.positive : color.negative }}>{formatSignedNumber(row.qty_impact)}</span> },
    { title: '单价影响（万元）', key: 'price_impact', align: 'right', sorter: (a, b) => a.price_impact - b.price_impact, render: (_v, row) => <span style={{ color: row.price_impact >= 0 ? color.positive : color.negative }}>{formatSignedNumber(row.price_impact)}</span> },
    { title: '收入变动（万元）', key: 'diff', align: 'right', sorter: (a, b) => a.diff - b.diff, render: (_v, row) => <ChangeTag diff={row.diff} format="currency" goodDirection="up" /> },
  ]
  const topNegative = sortedSeries.filter((row) => row.diff < 0)

  const setRows: SetCompareRow[] = [
    { key: 'qty', name: '订单量（单）', base: sets.base.qty, current: sets.current.qty, diff: sets.current.qty - sets.base.qty, kind: 'count' },
    { key: 'amount', name: '销售额（元）', base: sets.base.amount, current: sets.current.amount, diff: sets.diff, kind: 'yuan' },
    { key: 'avg_price', name: '实收单价（元）', base: sets.base.avg_price, current: sets.current.avg_price, diff: sets.current.avg_price - sets.base.avg_price, kind: 'yuan' },
    { key: 'dish', name: '菜品收入（元）', base: sets.base.dish_revenue, current: sets.current.dish_revenue, diff: sets.current.dish_revenue - sets.base.dish_revenue, kind: 'yuan' },
    { key: 'discount', name: '菜品优惠（元）', base: sets.base.discount, current: sets.current.discount, diff: sets.current.discount - sets.base.discount, kind: 'yuan' },
    { key: 'discount_rate', name: '优惠率', base: sets.base.discount_rate, current: sets.current.discount_rate, diff: sets.current.discount_rate - sets.base.discount_rate, kind: 'pp' },
  ]

  return (
    <div className="page-stack">
      <ScopeNotice kind="revenue" />

      <ChartCard
        title="系列量价拆解"
        subtitle={`${scope === 'same_store' ? '同店口径' : '全店口径'} · 连环替代顺序：销量 → 单价 · 单位：万元`}
        segmented={{
          options: [
            { label: '同店口径', value: 'same_store' },
            { label: '全店口径', value: 'all' },
          ],
          value: scope,
          onChange: (value: string) => setScope(value as 'same_store' | 'all'),
        }}
        insights={insights}
        footer={
          <CaliberNote title="量价结论">
            {data.conclusion}（销量影响 {formatSignedNumber(data.total.qty_impact)} 万、单价影响{' '}
            {formatSignedNumber(data.total.price_impact)} 万，合计 {formatSignedNumber(data.total.diff)} 万）
          </CaliberNote>
        }
      >
        <BarChart
          categories={data.series.map((row) => row.name)}
          series={[
            { name: '销量影响', values: data.series.map((row) => row.qty_impact), color: color.primary, stack: 'impact' },
            { name: '单价影响', values: data.series.map((row) => row.price_impact), color: color.chartOrange, stack: 'impact' },
          ]}
          valueFormatter={(value) => formatWan(value)}
          unit="万元"
          height={340}
        />
      </ChartCard>

      <Card
        title="系列量价表"
        extra={<Tag color="blue">{scope === 'same_store' ? '同店 857.17 / 760.00' : '品类口径 1000.16 / 760.00'}</Tag>}
        styles={{ body: { padding: 0 } }}
      >
        <DataTable<SeriesRow>
          columns={seriesColumns}
          rows={data.series}
          rowKey={(row) => row.name}
          scrollX={1400}
          footer={
            <>
              <span>
                销量影响 <b>{formatSignedNumber(data.total.qty_impact)}</b> · 单价影响{' '}
                <b>{formatSignedNumber(data.total.price_impact)}</b>
              </span>
              <span style={{ color: '#6B7280' }}>
                收入变动 {formatWan(data.total.diff)} 万元（{formatWan(data.total.current)} vs{' '}
                {formatWan(data.total.base)}）
              </span>
              <ChangeTag diff={data.total.diff} format="currency" goodDirection="up" />
            </>
          }
        />
        <div style={{ padding: '0 16px 16px' }}>
          <CaliberNote>{data.note} 系列量价按「先量后价」：销量影响 =（本期销量 − 同期销量）× 同期单价；单价影响 =（本期单价 − 同期单价）× 本期销量。</CaliberNote>
        </div>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={11}>
          <Card
            title={items.length > 0 ? '单品 / 套餐影响额排行' : '影响额排行（系列级）'}
            extra={
              items.length > 0
                ? <Tag color="blue">{items.length} 个产品 · Top 12</Tag>
                : <Tag color="orange">单品明细待导入</Tag>
            }
            styles={{ body: { padding: 0 } }}
          >
            {items.length > 0 ? (
              <DataTable<ProductItemRow>
                columns={itemColumns}
                rows={sortedItems}
                rowKey={(row) => `${row.product_id ?? row.name}`}
                scrollX={980}
              />
            ) : (
              <DataTable<SeriesRow>
                columns={rankColumns}
                rows={sortedSeries}
                rowKey={(row) => `rank-${row.name}`}
              />
            )}
            <div style={{ padding: '0 16px 16px' }}>
              <CaliberNote title="单品排行说明">
                {items.length > 0
                  ? `单品/套餐明细来自 Excel「第二步-餐饮收入结构分析」套餐明细，共 ${items.length} 个产品；单品明细合计与系列表、Excel 表 4 不是同一快照，仅用于展示量价方向，验收数字以系列表与套餐表为准。`
                  : '「单品销售」数据集尚未导入，一期按系列级影响额排行展示 Top 8。'}
                {topNegative.length > 0
                  ? ` 当前负向系列：${topNegative.map((row) => `${row.name}（${formatSignedNumber(row.diff)} 万）`).join('、')}。`
                  : ''}
              </CaliberNote>
            </div>
          </Card>
        </Col>

        <Col xs={24} xl={13}>
          <Card
            title="套餐量价（套餐与单品分开统计）"
            extra={<Tag color="blue">数据来源：Excel 表 4</Tag>}
            styles={{ body: { padding: 0 } }}
          >
            <DataTable<SetCompareRow> columns={setColumns} rows={setRows} rowKey={(row) => row.key} />
            <div style={{ padding: 16, borderTop: '1px solid #F0F2F7' }}>
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 8 }}>
                <span>
                  量差 <b style={{ color: color.positive }}>{formatSignedNumber(sets.qty_impact)}</b> 元
                </span>
                <span>
                  价差 <b style={{ color: color.negative }}>{formatSignedNumber(sets.price_impact)}</b> 元
                </span>
                <span>
                  合计 <b>{formatSignedNumber(sets.diff)}</b> 元
                </span>
              </div>
              <CaliberNote title="口径说明">
                套餐量价按 销量 → 单价 连环替代：量差 =（本期订单 − 同期订单）× 同期单价；
                价差 =（本期实收单价 − 同期实收单价）× 本期订单。Excel 表 4 与 PPT p27 的套餐数据不同源，
                系统按 Excel 表 4 展示（PPT 数字只用于讲解）。套餐优惠率 = 菜品优惠 ÷ 销售额。
              </CaliberNote>
            </div>
          </Card>
        </Col>
      </Row>

      <Footnote title="数据来源与口径">
        产品数据来自 Excel「第二步-收入异动分析」B26:T57（系列销量/单价/收入）与「第二步-收入异动分析」B53:M57（套餐）。
        同店口径 857.17 / 760.00、全店（品类）口径 1000.16 / 760.00；四套收入合计中，产品页使用<b>品类口径</b> 1,000.16 / 760.00，
        与利润表口径 1,000.00 / 760.00 差 0.16 万元（源表取整），未做对齐。销量为「份」，单价 = 收入（元）÷ 销量。
      </Footnote>
    </div>
  )
}
