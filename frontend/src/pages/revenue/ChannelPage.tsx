import { Card, Col, Row, Tag } from 'antd'
import type { TableColumnsType } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useChannel } from '../../api/hooks'
import type { ChannelRow } from '../../api/types'
import { CaliberNote, Footnote } from '../../components/Notes'
import { ChangeTag } from '../../components/ChangeTag'
import { DataTable } from '../../components/DataTable'
import { PageError, PageLoading } from '../../components/PageState'
import { ScopeNotice } from '../../components/ScopeNotice'
import { useFilters } from '../../filters/FilterContext'
import { formatPercent, formatWan } from '../../utils/format'

const structureColumns: TableColumnsType<ChannelRow> = [
  {
    title: '渠道',
    dataIndex: 'name',
    key: 'name',
    width: 150,
    fixed: 'left',
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
    title: '同期（万元）',
    dataIndex: 'base',
    key: 'base',
    align: 'right',
    width: 116,
    render: (value: number) => formatWan(value),
  },
  {
    title: '同比差额（万元）',
    dataIndex: 'diff',
    key: 'diff',
    align: 'right',
    width: 140,
    sorter: (a, b) => a.current - a.base - (b.current - b.base),
    render: (_value, row) => (
      <ChangeTag diff={row.current - row.base} format="currency" goodDirection="up" />
    ),
  },
  {
    title: '增减率',
    dataIndex: 'rate',
    key: 'rate',
    align: 'right',
    width: 110,
    render: (_value, row) => (
      <ChangeTag
        diff={row.base === 0 ? null : row.current / row.base - 1}
        format="percent"
        goodDirection="up"
      />
    ),
  },
  {
    title: '占本期比',
    dataIndex: 'share',
    key: 'share',
    align: 'right',
    width: 100,
    render: (value: number) => formatPercent(value),
  },
]

const sameStoreColumns: TableColumnsType<ChannelRow> = [
  {
    title: '渠道',
    dataIndex: 'name',
    key: 'name',
    width: 150,
    fixed: 'left',
    render: (value: string) => <b style={{ fontWeight: 500 }}>{value}</b>,
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
    title: '本期同店（万元）',
    dataIndex: 'same_store',
    key: 'same_store',
    align: 'right',
    width: 146,
    sorter: (a, b) => a.same_store - b.same_store,
    render: (value: number) => formatWan(value),
  },
  {
    title: '新店分摊（万元）',
    dataIndex: 'new_store',
    key: 'new_store',
    align: 'right',
    width: 140,
    render: (value: number) => formatWan(value),
  },
  {
    title: '同店差额（万元）',
    dataIndex: 'diff',
    key: 'diff',
    align: 'right',
    width: 140,
    sorter: (a, b) => a.diff - b.diff,
    render: (_value, row) => <ChangeTag diff={row.diff} format="currency" goodDirection="up" />,
  },
  {
    title: '同店增减率',
    dataIndex: 'same_rate',
    key: 'same_rate',
    align: 'right',
    width: 120,
    render: (_value, row) => <ChangeTag diff={row.same_rate} format="percent" goodDirection="up" />,
  },
]

export function ChannelPage() {
  const { filters } = useFilters()
  const navigate = useNavigate()
  const query = useChannel(filters)

  if (query.isLoading) return <PageLoading />
  if (query.isError || !query.data) {
    return <PageError error={query.error} onRetry={() => void query.refetch()} />
  }

  const { data, insights } = query.data
  const total = data.total
  const topChannel = data.rows[0]
  const goDetail = (row: ChannelRow) => navigate(`/revenue/channel/${row.channel_id}`)

  return (
    <div className="page-stack">
      <ScopeNotice kind="revenue" />

      <Row gutter={[16, 16]}>
        {data.categories.map((category) => (
          <Col xs={24} md={8} key={category.name}>
            <Card styles={{ body: { padding: 16 } }}>
              <div style={{ fontSize: 13, color: '#6B7280' }}>{category.name}（渠道大类）</div>
              <div style={{ fontSize: 26, fontWeight: 600, marginTop: 4 }}>
                {formatWan(category.current)}
                <span style={{ fontSize: 13, color: '#9CA3AF', fontWeight: 400 }}> 万元</span>
              </div>
              <div style={{ marginTop: 6, fontSize: 12, color: '#9CA3AF' }}>
                同期 {formatWan(category.base)} · <ChangeTag diff={category.diff} format="currency" goodDirection="up" />{' '}
                <ChangeTag diff={category.rate} format="percent" goodDirection="up" />
              </div>
              <div style={{ marginTop: 4, fontSize: 12, color: '#9CA3AF' }}>
                占渠道口径 {formatPercent(category.current / total.current)}
              </div>
            </Card>
          </Col>
        ))}
        <Col xs={24} md={8}>
          <Card styles={{ body: { padding: 16 } }}>
            <div style={{ fontSize: 13, color: '#6B7280' }}>最大渠道 · {topChannel.name}</div>
            <div style={{ fontSize: 26, fontWeight: 600, marginTop: 4 }}>
              {formatWan(topChannel.current)}
              <span style={{ fontSize: 13, color: '#9CA3AF', fontWeight: 400 }}> 万元</span>
            </div>
            <div style={{ marginTop: 6, fontSize: 12, color: '#9CA3AF' }}>
              同期 {formatWan(topChannel.base)} ·{' '}
              <ChangeTag diff={topChannel.diff} format="currency" goodDirection="up" />{' '}
              <ChangeTag diff={topChannel.rate} format="percent" goodDirection="up" />
            </div>
            <div style={{ marginTop: 4, fontSize: 12, color: '#9CA3AF' }}>
              同店 {formatWan(topChannel.same_store)} / 新店分摊 {formatWan(topChannel.new_store)}
            </div>
          </Card>
        </Col>
      </Row>

      <Card
        title="渠道结构表"
        extra={<Tag color="blue">渠道口径 {formatWan(total.current)} / {formatWan(total.base)}</Tag>}
        styles={{ body: { padding: 0 } }}
      >
        <DataTable<ChannelRow>
          columns={structureColumns}
          rows={data.rows}
          rowKey={(row) => row.channel_id}
          scrollX={900}
          onRowClick={goDetail}
          footer={
            <>
              <span>
                合计 <b>{formatWan(total.current)}</b> 万元
              </span>
              <span style={{ color: '#6B7280' }}>
                同期 {formatWan(total.base)} · 与利润表口径差 0.44 万
              </span>
              <ChangeTag diff={total.diff} format="currency" goodDirection="up" />
            </>
          }
        />
        <div style={{ padding: '0 16px 16px' }}>
          <CaliberNote>{data.caliber_note}</CaliberNote>
        </div>
      </Card>

      <Card
        title="同店渠道异动表"
        extra={<span style={{ fontSize: 12, color: '#9CA3AF' }}>点击渠道行查看漏斗详情 · 新店按本期渠道占比分摊</span>}
        styles={{ body: { padding: 0 } }}
      >
        <DataTable<ChannelRow>
          columns={sameStoreColumns}
          rows={data.rows}
          rowKey={(row) => `same-${row.channel_id}`}
          scrollX={900}
          onRowClick={goDetail}
          footer={
            <>
              <span>
                同店合计 <b>{formatWan(total.same_store ?? null)}</b> 万元 · 新店分摊 <b>{formatWan(total.new_store ?? null)}</b> 万元
              </span>
              <span style={{ color: '#9CA3AF' }}>同店 + 新店 = 渠道本期收入（分项取整尾差 ≤ 0.02）</span>
            </>
          }
        />
      </Card>

      <Card title="渠道洞察" styles={{ body: { padding: 16 } }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {insights.map((item) => (
            <div className="ai-insight-item" key={item.title}>
              <div className="ai-insight-title">
                <Tag
                  color={item.level === 'positive' ? 'green' : item.level === 'negative' ? 'red' : 'blue'}
                  style={{ marginInlineEnd: 6 }}
                >
                  {item.level === 'positive' ? '正向' : item.level === 'negative' ? '负向' : '中性'}
                </Tag>
                {item.title}
              </div>
              <div className="ai-insight-text">{item.text}</div>
              <div className="ai-insight-evidence">证据：{item.evidence}</div>
            </div>
          ))}
        </div>
      </Card>

      <Footnote title="数据来源与口径">
        {data.caliber_note}
        <br />
        渠道 10 项：美团大众、扫码支付、线上活动优惠、抖音、会员储值消费、堂食现金、招商银行、京东外卖、美团外卖、饿了外卖。
        渠道合计 1,000.00 / 759.56（本页）；四套口径分别为利润表 1,000.00 / 760.00、渠道 1,000.00 / 759.56、门店 1,000.23 / 759.95、品类 1,000.16 / 760.00，差异 0.05–0.23 万元为源表取整，未做对齐。
        会员储值消费单列为渠道，若储值金额同时在其他渠道结算可能重复计算（Excel 未说明，按导入数据原样展示，已在口径说明标注风险）。
      </Footnote>
    </div>
  )
}
