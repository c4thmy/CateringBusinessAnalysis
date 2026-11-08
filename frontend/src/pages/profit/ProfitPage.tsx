import { Alert, Card, Col, Row, Tag } from 'antd'
import type { TableColumnsType } from 'antd'
import { useState } from 'react'
import { useProfit } from '../../api/hooks'
import type { ProfitRow } from '../../api/types'
import { ChartCard } from '../../components/ChartCard'
import { ChangeTag } from '../../components/ChangeTag'
import { DataTable } from '../../components/DataTable'
import { FactorTable } from '../../components/FactorTable'
import { Footnote } from '../../components/Notes'
import { PageError, PageLoading } from '../../components/PageState'
import { Waterfall } from '../../components/Waterfall'
import { useFilters } from '../../filters/FilterContext'
import { formatPercent, formatPp, formatWan } from '../../utils/format'

type BridgeView = 'chart' | 'table'

function goodDirectionOf(row: ProfitRow): 'up' | 'down' {
  return row.kind === 'cost' ? 'down' : 'up'
}

const columns: TableColumnsType<ProfitRow> = [
  {
    title: '科目',
    dataIndex: 'account',
    key: 'account',
    width: 150,
    render: (_value, row) => (
      <span
        style={{
          fontWeight: row.is_total || row.is_subtotal ? 600 : 400,
          color: row.kind === 'cost' ? '#4B5563' : undefined,
        }}
      >
        {row.account}
        {row.is_total ? (
          <Tag color="blue" style={{ marginInlineStart: 6 }}>
            合计
          </Tag>
        ) : null}
      </span>
    ),
  },
  {
    title: '本期（万元）',
    dataIndex: 'current',
    key: 'current',
    align: 'right',
    width: 116,
    render: (value: number | null, row) => (
      <span style={{ fontWeight: row.is_total ? 600 : 400 }}>{formatWan(value)}</span>
    ),
  },
  {
    title: '本期占收入比',
    dataIndex: 'current_ratio',
    key: 'current_ratio',
    align: 'right',
    width: 118,
    render: (value: number | null) => formatPercent(value),
  },
  {
    title: '同期（万元）',
    dataIndex: 'base',
    key: 'base',
    align: 'right',
    width: 112,
    render: (value: number | null) => formatWan(value),
  },
  {
    title: '同期占收入比',
    dataIndex: 'base_ratio',
    key: 'base_ratio',
    align: 'right',
    width: 118,
    render: (value: number | null) => formatPercent(value),
  },
  {
    title: '差额（万元）',
    dataIndex: 'diff',
    key: 'diff',
    align: 'right',
    width: 128,
    sorter: (a, b) => (a.diff ?? 0) - (b.diff ?? 0),
    render: (_value, row) => (
      <ChangeTag diff={row.diff} format="currency" goodDirection={goodDirectionOf(row)} />
    ),
  },
  {
    title: '增减率',
    dataIndex: 'rate',
    key: 'rate',
    align: 'right',
    width: 112,
    render: (_value, row) => (
      <ChangeTag diff={row.rate} format="percent" goodDirection={goodDirectionOf(row)} />
    ),
  },
  {
    title: '占收入比变动',
    dataIndex: 'ratio_pp',
    key: 'ratio_pp',
    align: 'right',
    width: 128,
    render: (_value, row) => (
      <ChangeTag diff={row.ratio_pp} format="pp" goodDirection={goodDirectionOf(row)} />
    ),
  },
]

export function ProfitPage() {
  const { filters } = useFilters()
  const query = useProfit(filters)
  const [bridgeView, setBridgeView] = useState<BridgeView>('chart')

  if (query.isLoading) return <PageLoading />
  if (query.isError || !query.data) {
    return <PageError error={query.error} onRetry={() => void query.refetch()} />
  }

  const { data, meta, insights } = query.data
  const isYtd = data.mode === 'ytd'
  const startLabel = isYtd ? '去年同期累计' : '2024-09 营业利润'
  const endLabel = isYtd ? '本期累计' : '2025-09 营业利润'
  const revenueRow = data.rows.find((row) => row.account === '营业收入')

  return (
    <div className="page-stack">
      {filters.baseline !== 'yoy' ? (
        <Alert
          type="warning"
          showIcon
          title="当前仅同期基准可用"
          description="预算 / 上期基准为二期导入范围，本页暂按同期（yoy）展示；预算达成与评分因此显示「二期」。"
        />
      ) : null}

      <Card
        title="利润表对比"
        extra={
          <span style={{ fontSize: 12, color: '#9CA3AF' }}>
            {meta.period} · {isYtd ? '累计口径' : '当月口径'}
          </span>
        }
        styles={{ body: { padding: 0 } }}
      >
        <DataTable<ProfitRow>
          columns={columns}
          rows={data.rows}
          rowKey={(row) => row.account}
          footer={
            <>
              <span>
                营业利润 <b>{formatWan(data.profit.current)}</b> 万元 vs 同期{' '}
                {formatWan(data.profit.base)} 万元
              </span>
              <ChangeTag diff={data.profit.diff} format="currency" goodDirection="up" />
              {revenueRow?.diff !== null && revenueRow?.diff !== undefined ? (
                <span style={{ color: '#9CA3AF' }}>
                  营业收入变动 {formatWan(revenueRow.diff)} 万元
                </span>
              ) : null}
            </>
          }
        />
      </Card>

      {data.profit_bridge ? (
      <ChartCard
        title="利润桥：营业利润变动拆解"
        subtitle={`${isYtd ? '2024-01~09 → 2025-01~09' : '2024-09 → 2025-09'} · 单位：万元 · 9 项因素、顺序固定`}
        segmented={{
          options: [
            { label: '瀑布图', value: 'chart' },
            { label: '因素表', value: 'table' },
          ],
          value: bridgeView,
          onChange: (value: string) => setBridgeView(value as BridgeView),
        }}
        insights={insights}
        footer={
          <Footnote title="利润桥口径">
            变动成本（食材、优惠及手续费、水电气低值、宣传费用）按「费率差 × 本期收入」计算，固定费用（工资奖金、宿舍房租、店铺房租、其它费用）按「基期 − 本期」计算；
            收入规模影响 =（本期收入 − 基期收入）× 基期边际贡献率 {formatPercent(data.profit_bridge.base_marginal_contribution_rate ?? 0.4187)}；9 项合计 {formatWan(data.profit_bridge.items.reduce((sum, item) => sum + item.impact, 0))} 万元。
          </Footnote>
        }
      >
        {bridgeView === 'chart' ? (
          <Waterfall
            start={data.profit_bridge.start}
            end={data.profit_bridge.end}
            items={data.profit_bridge.items}
            startLabel={startLabel}
            endLabel={endLabel}
          />
        ) : (
          <FactorTable items={data.profit_bridge.items} />
        )}
      </ChartCard>
      ) : (
        <Card title="利润桥：营业利润变动拆解" extra={<Tag color="orange">预算未导入</Tag>}>
          <div style={{ padding: 16, color: '#6B7280' }}>预算未导入或科目不完整，暂不展示利润桥；请切换为「同期」基准或先导入完整预算。</div>
        </Card>
      )}

      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card
            title={
              <span>
                预算达成 <Tag color="orange">二期</Tag>
              </span>
            }
            styles={{ body: { padding: 16 } }}
          >
            <div style={{ fontSize: 13, lineHeight: 1.9, color: '#6B7280' }}>
              预算数据集已保留导入能力（「数据导入 → 预算与目标」）。一期只展示实际 vs 同期；
              预算达成率、差异率与预测需要预算绝对值，二期随费用/毛利模块开放。
            </div>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card
            title={
              <span>
                经营综合评分 <Tag color="orange">二期</Tag>
              </span>
            }
            styles={{ body: { padding: 16 } }}
          >
            <div style={{ fontSize: 13, lineHeight: 1.9, color: '#6B7280' }}>
              综合评分需要预算达成、毛利率、费用率、满意度与竞对等跨模块指标，一期只做单指标对比，
              评分卡与达标率在二期实现。
            </div>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card
            title={
              <span>
                集团板块汇总 <Tag color="orange">二期</Tag>
              </span>
            }
            styles={{ body: { padding: 16 } }}
          >
            <div style={{ fontSize: 13, lineHeight: 1.9, color: '#6B7280' }}>
              Excel「总利润表」含电商、中央厨房、仓储等板块（模拟值），与餐饮门店口径不同。
              一期只取餐饮门店利润表，板块汇总与混合口径在二期开放。
            </div>
          </Card>
        </Col>
      </Row>

      <Footnote title="数据来源与口径">
        {data.note} 营业利润 = 营业收入 − 8 项成本费用（食材成本、优惠及手续费、水电气低值、宣传费用、工资奖金、宿舍房租、店铺房租、其它费用）；
        毛利率 =（营业收入 − 食材成本）÷ 营业收入。{meta.period} 营业利润 {formatWan(data.profit.current)} 万元，
        利润率 {formatPercent(data.profit.current / (revenueRow?.current ?? 1))}；同期利润率{' '}
        {formatPercent(data.profit.base != null && revenueRow?.base ? data.profit.base / revenueRow.base : null)}，占比变动{' '}
        {formatPp(
          data.profit.base != null && revenueRow?.base && revenueRow?.current
            ? (data.profit.current / revenueRow.current) - (data.profit.base / revenueRow.base)
            : null,
        )}。
        四套收入合计口径见各页面脚注，本页使用利润表口径。
      </Footnote>
    </div>
  )
}
