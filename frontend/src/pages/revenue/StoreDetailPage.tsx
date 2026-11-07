import { Alert, Button, Card, Col, Row, Tag } from 'antd'
import type { TableColumnsType } from 'antd'
import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useSameStore, useStoreDetail } from '../../api/hooks'
import type { DaypartRow } from '../../api/types'
import { ChangeTag } from '../../components/ChangeTag'
import { DataTable } from '../../components/DataTable'
import { ArrowLeftIcon } from '../../components/icons'
import { KpiCard } from '../../components/KpiCard'
import { CaliberNote, Footnote } from '../../components/Notes'
import { PageError, PageLoading } from '../../components/PageState'
import { useFilters } from '../../filters/FilterContext'
import {
  formatInteger,
  formatPercent,
  formatSignedPercent,
  formatTicket,
  formatTraffic,
  formatWan,
} from '../../utils/format'

const daypartColumns: TableColumnsType<DaypartRow> = [
  {
    title: '日类型',
    dataIndex: 'day_type',
    key: 'day_type',
    width: 100,
    render: (value: string, row) => (
      <span style={{ fontWeight: row.is_total ? 600 : 400 }}>{value}</span>
    ),
  },
  {
    title: '时段',
    dataIndex: 'daypart',
    key: 'daypart',
    width: 130,
    render: (value: string, row) => (
      <span style={{ fontWeight: row.is_total ? 600 : 400 }}>{value}</span>
    ),
  },
  {
    title: '本期客流',
    dataIndex: 'current',
    key: 'current',
    align: 'right',
    width: 110,
    render: (value: number) => formatInteger(value),
  },
  {
    title: '同期客流',
    dataIndex: 'base',
    key: 'base',
    align: 'right',
    width: 110,
    render: (value: number) => formatInteger(value),
  },
  {
    title: '客流差',
    dataIndex: 'diff',
    key: 'diff',
    align: 'right',
    width: 110,
    sorter: (a, b) => a.diff - b.diff,
    render: (_value, row) => <ChangeTag diff={row.diff} format="count" goodDirection="up" />,
  },
  {
    title: '增减率',
    dataIndex: 'rate',
    key: 'rate',
    align: 'right',
    width: 110,
    render: (_value, row) => <ChangeTag diff={row.rate} format="percent" goodDirection="up" />,
  },
  {
    title: '判断',
    key: 'flag',
    width: 110,
    render: (_value, row) =>
      row.highlight ? <Tag color="orange">下降主因</Tag> : null,
  },
]

function rankOf<T>(rows: T[], id: number, getter: (row: T) => number, idOf: (row: T) => number): number | null {
  const sorted = [...rows].sort((a, b) => getter(b) - getter(a))
  const index = sorted.findIndex((row) => idOf(row) === id)
  return index >= 0 ? index + 1 : null
}

export function StoreDetailPage() {
  const { filters } = useFilters()
  const { storeId } = useParams<{ storeId: string }>()
  const navigate = useNavigate()
  const numericId = Number(storeId)
  const detailQuery = useStoreDetail(filters, numericId)
  const sameStoreQuery = useSameStore(filters)

  const ranking = useMemo(() => {
    const rows = sameStoreQuery.data?.data.stores ?? []
    if (rows.length === 0) return null
    const total = rows.length
    const revenueRank = rankOf(rows, numericId, (row) => row.revenue.current, (row) => row.store_id)
    const trafficRank = rankOf(rows, numericId, (row) => row.traffic.current, (row) => row.store_id)
    const ticketRank = rankOf(rows, numericId, (row) => row.ticket.current, (row) => row.store_id)
    return { total, revenueRank, trafficRank, ticketRank }
  }, [sameStoreQuery.data, numericId])

  if (detailQuery.isLoading) return <PageLoading />
  if (detailQuery.isError || !detailQuery.data) {
    return <PageError error={detailQuery.error} onRetry={() => void detailQuery.refetch()} />
  }

  const { data, insights } = detailQuery.data
  const summary = data.summary
  const hasDayparts = data.dayparts.length > 0
  const workdayTotal = data.dayparts.find((row) => row.day_type === '工作日' && row.is_total)
  const holidayTotal = data.dayparts.find((row) => row.day_type === '节假日' && row.is_total)
  const lunchWorkday = data.dayparts.find((row) => row.day_type === '工作日' && row.daypart === '9:00-14:00')
  const dinnerWorkday = data.dayparts.find((row) => row.day_type === '工作日' && row.daypart === '14:00-24:00')

  return (
    <div className="page-stack">
      <Card styles={{ body: { padding: 16 } }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Button size="small" icon={<ArrowLeftIcon />} onClick={() => navigate('/revenue/same-store')}>
            返回同店异动
          </Button>
          <span style={{ fontSize: 18, fontWeight: 600 }}>{data.store.name}</span>
          <Tag>{data.store.region}</Tag>
          <Tag color="blue">同店</Tag>
          <span style={{ fontSize: 12, color: '#9CA3AF' }}>
            门店 ID {data.store.id} · {filters.period}
          </span>
        </div>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <KpiCard
            title="客流"
            metric="traffic"
            value={summary.traffic.current}
            valueFormat="count"
            unit="人次"
            base={summary.traffic.base}
            diff={summary.traffic.diff}
            diffFormat="number"
            footer={
              <span>
                客流影响 <ChangeTag diff={summary.traffic_impact} format="currency" goodDirection="up" />
              </span>
            }
            insights={insights}
          />
        </Col>
        <Col xs={24} md={8}>
          <KpiCard
            title="客单价"
            metric="ticket"
            value={summary.ticket.current}
            valueFormat="number"
            unit="元/人次"
            base={summary.ticket.base}
            diff={summary.ticket.diff}
            diffFormat="number"
            footer={
              <span>
                客单影响 <ChangeTag diff={summary.ticket_impact} format="currency" goodDirection="up" />
              </span>
            }
          />
        </Col>
        <Col xs={24} md={8}>
          <KpiCard
            title="营业收入"
            metric="revenue"
            value={summary.revenue.current}
            unit="万元"
            base={summary.revenue.base}
            diff={summary.revenue.diff}
            diffFormat="currency"
            footer={<span>收入增减率 {formatSignedPercent(summary.revenue.rate)}</span>}
          />
        </Col>
      </Row>

      <Card title="同店横向比较" styles={{ body: { padding: 16 } }}>
        {ranking ? (
          <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
            <RankItem label="收入排名" value={ranking.revenueRank} total={ranking.total} />
            <RankItem label="客流排名" value={ranking.trafficRank} total={ranking.total} />
            <RankItem label="客单排名" value={ranking.ticketRank} total={ranking.total} />
            <div style={{ fontSize: 12, color: '#9CA3AF', alignSelf: 'center' }}>
              排名按 {ranking.total} 家同店本期值降序；{data.store.name} 收入第 {ranking.revenueRank ?? '—'}、客流第{' '}
              {ranking.trafficRank ?? '—'}、客单第 {ranking.ticketRank ?? '—'}。
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 13, color: '#9CA3AF' }}>同店明细加载中，暂无法计算排名。</div>
        )}
      </Card>

      <Card
        title="时段客流下钻"
        extra={<span style={{ fontSize: 12, color: '#9CA3AF' }}>日类型 × 时段 · 单位：人次</span>}
        styles={{ body: { padding: 0 } }}
      >
        {hasDayparts ? (
          <>
            <DataTable<DaypartRow>
              columns={daypartColumns}
              rows={data.dayparts}
              rowKey={(row) => `${row.day_type}-${row.daypart}`}
              rowClassName={(row) => (row.highlight ? 'row-highlight-warning' : '')}
              footer={
                <>
                  <span>
                    总合计 本期 {formatInteger(summary.traffic.current)} / 同期{' '}
                    {formatInteger(summary.traffic.base)} 人次
                  </span>
                  <span style={{ color: '#6B7280' }}>
                    门店客流变化 {formatSignedPercent(summary.traffic.rate)} · 工作日{' '}
                    {formatPercent(workdayTotal?.rate ?? null)}、节假日 {formatPercent(holidayTotal?.rate ?? null)}
                  </span>
                </>
              }
            />
            <div style={{ padding: '0 16px 16px' }}>
              <Alert
                type="info"
                showIcon
                title="时段判断：工作日 9:00-14:00 与 14:00-24:00 为下降主因"
                description={`工作日合计 ${formatInteger(workdayTotal?.diff ?? null)} 人次（${formatPercent(workdayTotal?.rate ?? null)}），其中午市 ${formatInteger(lunchWorkday?.diff ?? null)}、晚市 ${formatInteger(dinnerWorkday?.diff ?? null)}；节假日 ${formatInteger(holidayTotal?.diff ?? null)} 人次（${formatPercent(holidayTotal?.rate ?? null)}）无法对冲。橙色行为下降贡献最大的时段。`}
                style={{ marginBottom: 12 }}
              />
              <CaliberNote>{data.note}</CaliberNote>
            </div>
          </>
        ) : (
          <div style={{ padding: 16 }}>
            <CaliberNote>{data.note}</CaliberNote>
          </div>
        )}
      </Card>

      <Footnote title="数据来源与口径">
        {data.note}
        <br />
        三项对比：本期/同期客流 {formatTraffic(summary.traffic.current)} / {formatTraffic(summary.traffic.base)} 人次；
        客单 {formatTicket(summary.ticket.current)} / {formatTicket(summary.ticket.base)} 元；
        收入 {formatWan(summary.revenue.current)} / {formatWan(summary.revenue.base)} 万元。
        时段表为整数人次口径，与同店客流表的两位小数口径存在取整差异；客流「人次」为导入值口径，Excel 未说明是下单人数还是到店人数（页面不自行换算）。
      </Footnote>
    </div>
  )
}

function RankItem({ label, value, total }: { label: string; value: number | null; total: number }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: '#9CA3AF' }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 600 }}>
        {value ?? '—'}
        <span style={{ fontSize: 12, color: '#9CA3AF', fontWeight: 400 }}> / {total}</span>
      </div>
    </div>
  )
}
