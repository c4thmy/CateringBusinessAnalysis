import { Alert, Card, Col, Row, Tag } from 'antd'
import { useState } from 'react'
import { useOverview } from '../../api/hooks'
import { ChartCard } from '../../components/ChartCard'
import { FactorTable } from '../../components/FactorTable'
import { KpiCard } from '../../components/KpiCard'
import { CaliberNote, Footnote } from '../../components/Notes'
import { PageError, PageLoading } from '../../components/PageState'
import { Waterfall } from '../../components/Waterfall'
import { useFilters } from '../../filters/FilterContext'
import { formatPercent, formatPp, formatSignedPercent, formatWan } from '../../utils/format'

type BridgeView = 'chart' | 'table'

/** 同期有数据的同店门店数（示例数据 13 家），用于 KPI 分位口径 */
const SAME_STORE_COUNT = 13

export function DashboardPage() {
  const { filters } = useFilters()
  const query = useOverview(filters)
  const [bridgeView, setBridgeView] = useState<BridgeView>('chart')

  if (query.isLoading) return <PageLoading />
  if (query.isError || !query.data) {
    return <PageError error={query.error} onRetry={() => void query.refetch()} />
  }

  const { data, meta, insights } = query.data
  const kpis = data.kpis
  const isYtd = meta.mode === 'ytd'
  const revenueRate = kpis.revenue.rate ?? null
  const profitRate = kpis.profit.rate ?? null
  const periodLabel = isYtd ? '2024-01~09 → 2025-01~09' : '2024-09 → 2025-09'

  const bridgeSegmented = {
    options: [
      { label: '瀑布图', value: 'chart' },
      { label: '因素表', value: 'table' },
    ],
    value: bridgeView,
    onChange: (value: string) => setBridgeView(value as BridgeView),
  }

  return (
    <div className="page-stack">
      {filters.store !== 'all' ? (
        <Alert
          type="warning"
          showIcon
          title="单店视角暂不可用"
          description="一期示例数据只提供品牌合计，门店级利润与结构分析二期开放；当前展示品牌口径，可在门店筛选切回「全部门店」。"
        />
      ) : null}
      {isYtd ? (
        <Alert type="info" showIcon title="累计口径" description={data.note ?? '当前为累计口径（2025-01~09 vs 2024-01~09）。'} />
      ) : null}
      {filters.baseline !== 'yoy' ? (
        <Alert
          type="warning"
          showIcon
          title="当前仅同期基准可用"
          description="预算 / 上期基准的数据集为二期导入范围，本页暂按同期（yoy）展示；筛选值已保留在 URL 中。"
        />
      ) : null}

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} xl={6}>
          <KpiCard
            title="营业收入"
            metric="revenue"
            value={kpis.revenue.value}
            unit="万元"
            base={kpis.revenue.base}
            baseLabel={isYtd ? '去年同期' : '同期'}
            diff={kpis.revenue.diff}
            diffFormat="currency"
            percentiles={data.percentiles.revenue}
            storeCount={data.percentiles.revenue ? SAME_STORE_COUNT : undefined}
            percentileHint={data.percentile_hints?.revenue}
            footer={<span>同比 {formatSignedPercent(revenueRate)} · 利润表口径</span>}
            insights={insights.slice(0, 1)}
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <KpiCard
            title="营业利润"
            metric="profit"
            value={kpis.profit.value}
            unit="万元"
            base={kpis.profit.base}
            baseLabel={isYtd ? '去年同期' : '同期'}
            diff={kpis.profit.diff}
            diffFormat="currency"
            percentiles={data.percentiles.profit}
            percentileHint={data.percentile_hints?.profit ?? '门店级营业利润明细未导入，暂不展示分位'}
            footer={<span>利润率 {formatPercent(kpis.profit.value !== null && kpis.revenue.value ? (kpis.profit.value ?? 0) / kpis.revenue.value : null)} · 同比 {formatSignedPercent(profitRate)}</span>}
            insights={insights.slice(1, 2)}
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <KpiCard
            title="综合毛利率"
            metric="gross_margin"
            value={kpis.gross_margin.value}
            valueFormat="percent"
            unit=""
            base={kpis.gross_margin.base}
            baseLabel={isYtd ? '去年同期' : '同期'}
            diff={kpis.gross_margin.diff}
            diffFormat="pp"
            percentiles={data.percentiles.gross_margin}
            storeCount={data.percentiles.gross_margin ? SAME_STORE_COUNT : undefined}
            percentileHint={data.percentile_hints?.gross_margin}
            footer={<span>毛利率变动 {formatPp(kpis.gross_margin.diff)}；门店分位 P50–P75</span>}
            insights={insights.slice(2, 3)}
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <KpiCard
            title="同店增速"
            metric="same_store_growth"
            value={kpis.same_store_growth.value}
            valueFormat="percent"
            unit=""
            base={kpis.same_store_growth.base}
            diff={kpis.same_store_growth.diff}
            diffFormat="pp"
            percentiles={data.percentiles.same_store_growth}
            storeCount={data.percentiles.same_store_growth ? SAME_STORE_COUNT : undefined}
            percentileHint={data.percentile_hints?.same_store_growth ?? '累计同店口径未提供数据'}
            footer={
              isYtd ? (
                <span>累计同店口径未提供数据（—）</span>
              ) : (
                <span>同店收入 857.23 万元 · 新店收入 143.00 万元</span>
              )
            }
            insights={insights.slice(0, 1)}
          />
        </Col>
      </Row>

      <ChartCard
        title="利润桥：营业利润变动拆解"
        subtitle={`${periodLabel} · 单位：万元 · 连环替代顺序固定为「收入规模 → 变动成本率 → 固定费用」`}
        segmented={bridgeSegmented}
        insights={insights}
        footer={
          <Footnote title="利润桥口径">
            基期营业利润 {formatWan(data.profit_bridge.start)} 万元 → 本期 {formatWan(data.profit_bridge.end)} 万元；
            收入规模影响 =（本期收入 − 基期收入）× 基期边际贡献率 41.87%；变动成本按「费率差 × 本期收入」、固定费用按「基期 − 本期」计算；
            9 项影响合计 {formatWan(data.profit_bridge.items.reduce((sum, item) => sum + item.impact, 0))} 万元。
          </Footnote>
        }
      >
        {bridgeView === 'chart' ? (
          <Waterfall
            start={data.profit_bridge.start}
            end={data.profit_bridge.end}
            items={data.profit_bridge.items}
            startLabel={isYtd ? '去年同期累计' : '2024-09 营业利润'}
            endLabel={isYtd ? '本期累计' : '2025-09 营业利润'}
          />
        ) : (
          <FactorTable items={data.profit_bridge.items} />
        )}
      </ChartCard>

      <Card
        title="一句话结论"
        extra={<Tag color="blue">规则生成 · 非大模型</Tag>}
        styles={{ body: { padding: 16 } }}
      >
        <div style={{ fontSize: 15, lineHeight: 1.9, fontWeight: 500 }}>{data.summary}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
          {insights.map((item) => (
            <div key={item.title} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <Tag color={item.level === 'positive' ? 'green' : item.level === 'negative' ? 'red' : 'blue'} style={{ marginTop: 2 }}>
                {item.level === 'positive' ? '正向' : item.level === 'negative' ? '负向' : '中性'}
              </Tag>
              <div style={{ fontSize: 13, lineHeight: 1.8, color: '#4B5563' }}>
                <b style={{ color: '#1F2430' }}>{item.title}</b>：{item.text}
                <span style={{ color: '#9CA3AF' }}>（证据：{item.evidence}）</span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Footnote title="数据来源与口径">
        数据来源：{meta.period} vs {meta.baseline === 'yoy' ? '同期' : meta.baseline} 利润表口径（Excel「2025年月利润表数据」L/Z 列，2024-09 760.00 万元 → 2025-09 1,000.00 万元）。
        四套收入合计分别标注：<b>利润表口径</b> 1,000.00 / 760.00（本页、利润桥、毛利率）、<b>渠道口径</b> 1,000.00 / 759.56（收入结构、渠道页）、
        <b>门店口径</b> 1,000.23 / 759.95（同店异动、门店排行）、<b>品类口径</b> 1,000.16 / 760.00（产品量价）；差异 0.05–0.23 万元为源表取整与汇总范围不同，未做强行对齐。
        边际贡献率 = 1 −（食材 + 优惠及手续费 + 水电气低值 + 宣传）费率 = 41.87%（基期），展示保留 2 位。
      </Footnote>

      {isYtd ? (
        <CaliberNote>
          累计口径为 2025-01~09 vs 2024-01~09（Excel「当月和累计数据对比分析」）；累计口径下门店分位不可用，页面以「—」展示。
        </CaliberNote>
      ) : null}
    </div>
  )
}
