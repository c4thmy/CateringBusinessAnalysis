import { Card, Col, Row } from 'antd'
import type { TableColumnsType } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useSameStore } from '../../api/hooks'
import type { StoreRow } from '../../api/types'
import { ChangeTag } from '../../components/ChangeTag'
import { DataTable } from '../../components/DataTable'
import { ImpactBar } from '../../components/ImpactBar'
import { KpiCard } from '../../components/KpiCard'
import { CaliberNote, Footnote } from '../../components/Notes'
import { PageError, PageLoading } from '../../components/PageState'
import { ScopeNotice } from '../../components/ScopeNotice'
import { useFilters } from '../../filters/FilterContext'
import { color } from '../../theme'
import {
  formatSignedPercent,
  formatTicket,
  formatTraffic,
  formatWan,
} from '../../utils/format'

const columns: TableColumnsType<StoreRow> = [
  {
    title: '门店',
    dataIndex: 'store_name',
    key: 'store_name',
    width: 110,
    fixed: 'left',
    render: (value: string) => <b style={{ fontWeight: 500 }}>{value}</b>,
  },
  { title: '区域', dataIndex: 'region', key: 'region', width: 90 },
  {
    title: '本期客流',
    key: 'traffic_current',
    align: 'right',
    width: 116,
    sorter: (a, b) => a.traffic.current - b.traffic.current,
    render: (_value, row) => formatTraffic(row.traffic.current),
  },
  {
    title: '同期客流',
    key: 'traffic_base',
    align: 'right',
    width: 116,
    render: (_value, row) => formatTraffic(row.traffic.base),
  },
  {
    title: '客流差',
    key: 'traffic_diff',
    align: 'right',
    width: 112,
    sorter: (a, b) => a.traffic.current - a.traffic.base - (b.traffic.current - b.traffic.base),
    render: (_value, row) => (
      <ChangeTag
        diff={row.traffic.current - row.traffic.base}
        format="number"
        goodDirection="up"
      />
    ),
  },
  {
    title: '本期客单',
    key: 'ticket_current',
    align: 'right',
    width: 108,
    render: (_value, row) => formatTicket(row.ticket.current),
  },
  {
    title: '同期客单',
    key: 'ticket_base',
    align: 'right',
    width: 108,
    render: (_value, row) => formatTicket(row.ticket.base),
  },
  {
    title: '客单差',
    key: 'ticket_diff',
    align: 'right',
    width: 100,
    render: (_value, row) => (
      <ChangeTag diff={row.ticket.current - row.ticket.base} format="number" goodDirection="up" />
    ),
  },
  {
    title: '本期收入',
    key: 'revenue_current',
    align: 'right',
    width: 112,
    render: (_value, row) => formatWan(row.revenue.current),
  },
  {
    title: '同期收入',
    key: 'revenue_base',
    align: 'right',
    width: 112,
    render: (_value, row) => formatWan(row.revenue.base),
  },
  {
    title: '收入差',
    dataIndex: 'diff',
    key: 'diff',
    align: 'right',
    width: 116,
    sorter: (a, b) => a.diff - b.diff,
    render: (_value, row) => <ChangeTag diff={row.diff} format="currency" goodDirection="up" />,
  },
  {
    title: '客流影响',
    dataIndex: 'traffic_impact',
    key: 'traffic_impact',
    align: 'right',
    width: 116,
    sorter: (a, b) => a.traffic_impact - b.traffic_impact,
    render: (_value, row) => <ChangeTag diff={row.traffic_impact} format="currency" goodDirection="up" />,
  },
  {
    title: '客单影响',
    dataIndex: 'ticket_impact',
    key: 'ticket_impact',
    align: 'right',
    width: 116,
    sorter: (a, b) => a.ticket_impact - b.ticket_impact,
    render: (_value, row) => <ChangeTag diff={row.ticket_impact} format="currency" goodDirection="up" />,
  },
  {
    title: '增减率',
    key: 'rate',
    align: 'right',
    width: 108,
    sorter: (a, b) => (a.revenue.rate ?? 0) - (b.revenue.rate ?? 0),
    render: (_value, row) => <ChangeTag diff={row.revenue.rate} format="percent" goodDirection="up" />,
  },
]

export function SameStorePage() {
  const { filters } = useFilters()
  const navigate = useNavigate()
  const query = useSameStore(filters)

  if (query.isLoading) return <PageLoading />
  if (query.isError || !query.data) {
    return <PageError error={query.error} onRetry={() => void query.refetch()} />
  }

  const { data, insights } = query.data
  const summary = data.summary
  const newStoreTotal = data.new_stores.reduce((sum, item) => sum + item.revenue, 0)

  return (
    <div className="page-stack">
      <ScopeNotice kind="revenue" />

      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <KpiCard
            title="同店收入"
            metric="revenue"
            value={summary.current}
            unit="万元"
            base={summary.base}
            diff={summary.diff}
            diffFormat="currency"
            footer={<span>同店增速 {formatSignedPercent(summary.rate)} · 门店口径</span>}
            insights={insights.slice(0, 1)}
          />
        </Col>
        <Col xs={24} md={8}>
          <KpiCard
            title="同店客流"
            metric="traffic"
            value={summary.traffic.current}
            valueFormat="count"
            unit="人次"
            base={summary.traffic.base}
            diff={summary.traffic.diff}
            diffFormat="number"
            footer={<span>客流增速 {formatSignedPercent(summary.traffic.rate)}</span>}
          />
        </Col>
        <Col xs={24} md={8}>
          <KpiCard
            title="同店客单"
            metric="ticket"
            value={summary.ticket.current}
            valueFormat="number"
            unit="元/人次"
            base={summary.ticket.base}
            diff={summary.ticket.diff}
            diffFormat="number"
            footer={<span>客单增速 {formatSignedPercent(summary.ticket.rate)}</span>}
          />
        </Col>
      </Row>

      <Card
        title="同店收入拆解：客流 × 客单"
        extra={<span style={{ fontSize: 12, color: '#9CA3AF' }}>先量后价连环替代</span>}
        styles={{ body: { padding: 16 } }}
      >
        <ImpactBar
          items={[
            { key: 'traffic', label: '客流影响', value: summary.traffic_impact, color: color.primary },
            { key: 'ticket', label: '客单影响', value: summary.ticket_impact, color: color.chartLightBlue },
          ]}
          totalDiff={summary.diff}
          note={summary.variance_note}
        />
      </Card>

      <Card
        title="{data.stores.length} 家同店明细"
        extra={<span style={{ fontSize: 12, color: '#9CA3AF' }}>点击门店行下钻单店详情</span>}
        styles={{ body: { padding: 0 } }}
      >
        <DataTable<StoreRow>
          columns={columns}
          rows={data.stores}
          rowKey={(row) => row.store_id}
          scrollX={1500}
          onRowClick={(row) => navigate(`/revenue/store/${row.store_id}`)}
          footer={
            <>
              <span>
                13 店合计 <b>{formatWan(summary.current)}</b> 万元
              </span>
              <span style={{ color: '#6B7280' }}>
                客流影响 {formatWan(summary.traffic_impact)} · 客单影响 {formatWan(summary.ticket_impact)}
              </span>
              <ChangeTag diff={summary.diff} format="currency" goodDirection="up" />
            </>
          }
        />
        <div style={{ padding: '0 16px 16px' }}>
          <CaliberNote>{data.caliber_note}</CaliberNote>
        </div>
      </Card>

      <Card
        title="新店收入（同期为 0）"
        extra={<span style={{ fontSize: 12, color: '#9CA3AF' }}>新店 = 2024-09 无收入的门店</span>}
        styles={{ body: { padding: 16 } }}
      >
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          {data.new_stores.map((item) => (
            <div key={item.store_id} style={{ minWidth: 160 }}>
              <div style={{ fontSize: 12, color: '#9CA3AF' }}>{item.store_name}</div>
              <div style={{ fontSize: 22, fontWeight: 600 }}>{formatWan(item.revenue)}</div>
              <div style={{ fontSize: 12, color: '#6B7280' }}>万元 · 同期 0.00</div>
            </div>
          ))}
          <div style={{ minWidth: 160, borderLeft: '1px dashed #EDEFF5', paddingLeft: 24 }}>
            <div style={{ fontSize: 12, color: '#9CA3AF' }}>新店合计</div>
            <div style={{ fontSize: 22, fontWeight: 600, color: color.primary }}>{formatWan(newStoreTotal)}</div>
            <div style={{ fontSize: 12, color: '#6B7280' }}>万元 · 占门店口径 14.3%</div>
          </div>
        </div>
      </Card>

      <Footnote title="数据来源与口径">
        {data.caliber_note}
        <br />
        四套合计：利润表 1,000.00 / 760.00；渠道 1,000.00 / 759.56；<b>门店 1,000.23 / 759.95（本页）</b>；品类 1,000.16 / 760.00。
        本页同店 857.23 / 759.95、新店 143.00 / 0，门店合计 1,000.23 / 759.95，与利润表口径差 0.23 万元（源表取整，不做对齐）。
        客流/客单影响保留 2 位小数；展示值相加与合计不一致时以本页「尾差说明」为准。
      </Footnote>
    </div>
  )
}
