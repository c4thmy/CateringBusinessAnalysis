import { Alert, Button, Card, Col, Row, Tag } from 'antd'
import type { TableColumnsType } from 'antd'
import ReactECharts from 'echarts-for-react'
import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useChannelDetail } from '../../api/hooks'
import { ChangeTag } from '../../components/ChangeTag'
import { DataTable } from '../../components/DataTable'
import { EmptyState } from '../../components/EmptyState'
import { ArrowLeftIcon } from '../../components/icons'
import { CaliberNote, Footnote } from '../../components/Notes'
import { PageError, PageLoading } from '../../components/PageState'
import { ScopeNotice } from '../../components/ScopeNotice'
import { ThresholdBar } from '../../components/ThresholdBar'
import { useFilters } from '../../filters/FilterContext'
import { color } from '../../theme'
import { formatInteger, formatPercent, formatPp, formatWan } from '../../utils/format'

interface FunnelStageRow {
  key: string
  stage: string
  count: number
  cvr: number | null
  mom: number | null
  flag: string | null
}

const funnelColumns: TableColumnsType<FunnelStageRow> = [
  { title: '阶段', dataIndex: 'stage', key: 'stage', width: 140 },
  {
    title: '人数',
    dataIndex: 'count',
    key: 'count',
    align: 'right',
    width: 140,
    render: (value: number) => formatInteger(value),
  },
  {
    title: '转化率',
    dataIndex: 'cvr',
    key: 'cvr',
    align: 'right',
    width: 110,
    render: (value: number | null) => formatPercent(value),
  },
  {
    title: '环比变化',
    key: 'mom',
    align: 'right',
    width: 120,
    render: (_value, row) =>
      row.mom === null ? <span style={{ color: '#9CA3AF' }}>—</span> : <ChangeTag diff={row.mom} format="pp" goodDirection="up" />,
  },
  {
    title: '判断',
    key: 'flag',
    width: 180,
    render: (_value, row) => (row.flag ? <Tag color="orange">{row.flag}</Tag> : null),
  },
]

/** 单渠道详情：曝光→访问→支付→消费漏斗 + 转化率 + 平台费用率 / ROI + 阈值线 */
export function ChannelDetailPage() {
  const { filters } = useFilters()
  const { channelId } = useParams<{ channelId: string }>()
  const navigate = useNavigate()
  const numericId = Number(channelId)
  const query = useChannelDetail(filters, numericId)

  const funnelOption = useMemo(() => {
    const funnel = query.data?.data.funnel
    if (!funnel) return null
    return {
      tooltip: {
        trigger: 'item',
        formatter: (params: { name?: string; value?: number }) =>
          `${params.name ?? ''}<br/>${formatInteger(params.value ?? 0)} 人`,
      },
      series: [
        {
          type: 'funnel',
          left: '8%',
          right: '8%',
          top: 10,
          bottom: 10,
          minSize: '28%',
          maxSize: '100%',
          sort: 'descending',
          gap: 2,
          label: {
            show: true,
            position: 'inside',
            color: '#FFFFFF',
            fontSize: 12,
            formatter: (params: { name?: string; value?: number }) =>
              `${params.name ?? ''} ${formatInteger(params.value ?? 0)}`,
          },
          itemStyle: { borderColor: '#FFFFFF', borderWidth: 2 },
          data: [
            { value: funnel.exposure, name: '曝光' },
            { value: funnel.visits, name: '访问' },
            { value: funnel.payers, name: '支付' },
            { value: funnel.consumers, name: '消费' },
          ],
          color: [color.chartBlue, '#4C6FF0', color.chartLightBlue, '#A5B4F8'],
        },
      ],
    } as unknown as Record<string, unknown>
  }, [query.data])

  if (query.isLoading) return <PageLoading />
  if (query.isError || !query.data) {
    return <PageError error={query.error} onRetry={() => void query.refetch()} />
  }

  const { data, insights } = query.data
  const funnel = data.funnel
  const economics = data.economics

  const header = (
    <Card styles={{ body: { padding: 16 } }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <Button size="small" icon={<ArrowLeftIcon />} onClick={() => navigate('/revenue/channel')}>
          返回渠道下钻
        </Button>
        <span style={{ fontSize: 18, fontWeight: 600 }}>{data.channel.name}</span>
        {data.channel.category ? <Tag>{data.channel.category}</Tag> : null}
        <Tag color="blue">渠道 ID {data.channel.id}</Tag>
        <span style={{ fontSize: 12, color: '#9CA3AF' }}>{filters.period} · 线上渠道</span>
      </div>
    </Card>
  )

  if (!funnel || !economics) {
    return (
      <div className="page-stack">
        <ScopeNotice kind="revenue" />
        {header}
        <EmptyState
          title="该渠道暂无线上漏斗数据"
          description={data.note ?? '一期示例数据只导入大众点评的曝光转化与平台费用。'}
          action={
            <Button type="primary" onClick={() => navigate('/revenue/channel')} style={{ marginTop: 12 }}>
              返回渠道列表
            </Button>
          }
        />
      </div>
    )
  }

  const stages: { key: string; name: string; value: number; rate: number | null; rateLabel: string; mom: number | null }[] = [
    { key: 'exposure', name: '曝光人数', value: funnel.exposure, rate: null, rateLabel: '漏斗入口', mom: null },
    { key: 'visits', name: '访问人数', value: funnel.visits, rate: funnel.exposure_visit, rateLabel: '曝光→访问', mom: funnel.mom_change.exposure_visit },
    { key: 'payers', name: '支付人数', value: funnel.payers, rate: funnel.visit_pay, rateLabel: '访问→支付', mom: funnel.mom_change.visit_pay },
    { key: 'consumers', name: '消费人数', value: funnel.consumers, rate: funnel.pay_consume, rateLabel: '支付→消费', mom: funnel.mom_change.pay_consume },
  ]

  const newCustomerShare = funnel.brand_customers > 0 ? funnel.new_customers / funnel.brand_customers : null
  const oldCustomerShare = funnel.brand_customers > 0 ? funnel.old_customers / funnel.brand_customers : null
  const payCvrDrop = (funnel.mom_change.visit_pay ?? 0) < -0.01

  const funnelRows: FunnelStageRow[] = [
    { key: 'exposure', stage: '曝光人数', count: funnel.exposure, cvr: null, mom: null, flag: null },
    { key: 'visits', stage: '访问人数', count: funnel.visits, cvr: funnel.exposure_visit, mom: funnel.mom_change.exposure_visit, flag: null },
    {
      key: 'payers',
      stage: '支付人数',
      count: funnel.payers,
      cvr: funnel.visit_pay,
      mom: funnel.mom_change.visit_pay,
      flag: payCvrDrop ? '访问-支付转化环比下降超 1pp' : null,
    },
    { key: 'consumers', stage: '消费人数', count: funnel.consumers, cvr: funnel.pay_consume, mom: funnel.mom_change.pay_consume, flag: null },
  ]

  return (
    <div className="page-stack">
      <ScopeNotice kind="revenue" />
      {header}

      {payCvrDrop ? (
        <Alert
          type="warning"
          showIcon
          title="转化率异常：访问-支付转化率环比下降 1.2pp"
          description="超过「漏斗任一层转化率环比下降 > 1pp」的异常阈值（design.md 第 15 节规则 5），建议优先排查门店详情页与团购券核销流程。"
        />
      ) : null}

      <Row gutter={[16, 16]}>
        {stages.map((stage) => (
          <Col xs={24} sm={12} xl={6} key={stage.key}>
            <Card styles={{ body: { padding: 16 } }}>
              <div style={{ fontSize: 13, color: '#6B7280' }}>{stage.name}</div>
              <div style={{ fontSize: 26, fontWeight: 600, marginTop: 4 }}>{formatInteger(stage.value)}</div>
              <div style={{ marginTop: 6, fontSize: 12, color: '#9CA3AF' }}>
                {stage.rate === null ? stage.rateLabel : `${stage.rateLabel} ${formatPercent(stage.rate)}`}
              </div>
              {stage.mom !== null ? (
                <div style={{ marginTop: 4, fontSize: 12 }}>
                  环比 <ChangeTag diff={stage.mom} format="pp" goodDirection="up" />
                </div>
              ) : null}
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={12}>
          <Card title="曝光 → 访问 → 支付 → 消费 漏斗" styles={{ body: { padding: 16 } }}>
            {funnelOption ? (
              <ReactECharts option={funnelOption} style={{ height: 320 }} opts={{ renderer: 'canvas' }} notMerge />
            ) : null}
            <CaliberNote title="顾客结构">
              品牌顾客 {formatInteger(funnel.brand_customers)} 人 = 新客 {formatInteger(funnel.new_customers)}（
              {formatPercent(newCustomerShare)}）+ 老客 {formatInteger(funnel.old_customers)}（{formatPercent(oldCustomerShare)}）；
              曝光→支付转化 {formatPercent(funnel.exposure_pay)}（目标 1.5%，见 Excel 表 8 增收提价预算）。
            </CaliberNote>
          </Card>
        </Col>
        <Col xs={24} xl={12}>
          <Card title="漏斗明细与转化率" styles={{ body: { padding: 0 } }}>
            <DataTable<FunnelStageRow>
              columns={funnelColumns}
              rows={funnelRows}
              rowKey={(row) => row.key}
              footer={
                <span style={{ color: '#6B7280' }}>
                  访问-支付转化率环比 {formatPp(funnel.mom_change.visit_pay)}；阈值：单层转化率环比下降 &gt; 1pp 标异常。
                </span>
              }
            />
          </Card>
        </Col>
      </Row>

      <Card
        title="平台费用率与 ROI（阈值对比）"
        extra={<Tag color="orange">阈值可配置</Tag>}
        styles={{ body: { padding: 16 } }}
      >
        <Row gutter={[24, 16]}>
          <Col xs={24} md={8}>
            <ThresholdBar
              label="平台费用率"
              value={economics.fee_rate}
              format="percent"
              threshold={economics.thresholds.fee_rate}
              direction="max"
              status={economics.status.fee_rate}
              domainMax={0.6}
              unit="平台费用 ÷ 平台收入"
              note={`平台费用 ${formatWan(economics.platform_fee)} 万元 / 平台收入 ${formatWan(economics.revenue)} 万元`}
            />
          </Col>
          <Col xs={24} md={8}>
            <ThresholdBar
              label="毛利 ROI"
              value={economics.gross_roi}
              format="number"
              threshold={economics.thresholds.gross_roi}
              direction="min"
              status={economics.status.gross_roi}
              domainMax={4}
              unit="毛利额 ÷ 平台费用"
              note={`毛利额 ${formatWan(economics.gross_profit)} 万元 / 平台费用 ${formatWan(economics.platform_fee)} 万元`}
            />
          </Col>
          <Col xs={24} md={8}>
            <ThresholdBar
              label="销售 ROI"
              value={economics.sales_roi}
              format="number"
              threshold={economics.thresholds.sales_roi}
              direction="min"
              status={economics.status.sales_roi}
              domainMax={6}
              unit="平台销售额 ÷ 平台费用"
              note={`平台销售额 ${formatWan(economics.revenue)} 万元 / 平台费用 ${formatWan(economics.platform_fee)} 万元`}
            />
          </Col>
        </Row>
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
        {data.note}
        <br />
        阈值：平台费用率 ≤ 15.0%、毛利 ROI ≥ 1.0、销售 ROI ≥ 4.0（PPT p28；阈值放在后端 config.py，可在二期做成可配置）。
        漏斗人数为「人数」口径，不是订单数；缺失值显示「—」，不补 0。平台费用与毛利额来自 Excel 表 8 的口径换算，
        毛利 ROI = 毛利额 ÷ 平台费用，销售 ROI = 平台销售额 ÷ 平台费用。
      </Footnote>
    </div>
  )
}
