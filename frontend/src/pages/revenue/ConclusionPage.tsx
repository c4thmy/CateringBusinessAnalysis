import { Card, Col, Row, Tag, Button } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useConclusion } from '../../api/hooks'
import { ChangeTag } from '../../components/ChangeTag'
import { ImpactBar } from '../../components/ImpactBar'
import { CaliberNote, Footnote } from '../../components/Notes'
import { PageError, PageLoading } from '../../components/PageState'
import { ScopeNotice } from '../../components/ScopeNotice'
import { useFilters } from '../../filters/FilterContext'
import { color } from '../../theme'
import { formatWan } from '../../utils/format'

export function ConclusionPage() {
  const { filters } = useFilters()
  const navigate = useNavigate()
  const query = useConclusion(filters)

  if (query.isLoading) return <PageLoading />
  if (query.isError || !query.data) {
    return <PageError error={query.error} onRetry={() => void query.refetch()} />
  }

  const { data, insights } = query.data
  const summary = data.summary

  const items = [
    { key: 'new_store', label: '新店贡献', value: summary.new_store, color: color.chartBlue },
    { key: 'same_store_traffic', label: '同店客流影响', value: summary.same_store_traffic, color: color.primary },
    { key: 'same_store_ticket', label: '同店客单影响', value: summary.same_store_ticket, color: color.chartLightBlue },
    { key: 'closed_store', label: '闭店影响', value: summary.closed_store, color: color.chartGray },
  ]

  return (
    <div className="page-stack">
      <ScopeNotice kind="revenue" />

      <Row gutter={[16, 16]}>
        {items.map((item) => (
          <Col xs={24} sm={12} xl={6} key={item.key}>
            <Card styles={{ body: { padding: 16 } }}>
              <div style={{ fontSize: 13, color: '#6B7280', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: item.color, display: 'inline-block' }} />
                {item.label}
              </div>
              <div style={{ fontSize: 26, fontWeight: 600, marginTop: 4 }}>
                {summary[item.key as keyof typeof summary] === 0 ? '0.00' : formatWan(item.value)}
                <span style={{ fontSize: 13, color: '#9CA3AF', fontWeight: 400 }}> 万元</span>
              </div>
              <div style={{ marginTop: 6, fontSize: 12, color: '#9CA3AF' }}>
                占收入变动 {summary.total_diff !== 0 ? `${((item.value / summary.total_diff) * 100).toFixed(1)}%` : '—'}
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <Card
        title="收入异动汇总：+240 万从哪来"
        extra={<ChangeTag diff={summary.total_diff} format="currency" goodDirection="up" suffix=" 万元" />}
        styles={{ body: { padding: 16 } }}
      >
        <ImpactBar items={items} totalDiff={summary.total_diff} note={summary.variance_note} />
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={14}>
          <Card
            title="自动结论"
            extra={<Tag color="blue">规则生成 · 顺序固定</Tag>}
            styles={{ body: { padding: 16 } }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {data.conclusions.map((text, index) => (
                <div key={text} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span
                    style={{
                      flex: 'none',
                      width: 22,
                      height: 22,
                      borderRadius: 4,
                      background: '#E8ECFD',
                      color: color.primary,
                      fontSize: 12,
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {index + 1}
                  </span>
                  <div style={{ fontSize: 13, lineHeight: 1.85, color: '#374151' }}>{text}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 14 }}>
              <CaliberNote>{data.caliber_note}</CaliberNote>
            </div>
          </Card>
        </Col>

        <Col xs={24} xl={10}>
          <Card
            title="规则化洞察"
            extra={<Tag color="blue">非大模型</Tag>}
            styles={{ body: { padding: 16 } }}
          >
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
        </Col>
      </Row>

      <Card
        title="三条建议动作（下月计划）"
        extra={
          <Button size="small" onClick={() => navigate('/summary')}>
            进入总结 & 计划（二期）
          </Button>
        }
        styles={{ body: { padding: 16 } }}
      >
        <Row gutter={[16, 16]}>
          {data.actions.map((action, index) => (
            <Col xs={24} md={8} key={action.title}>
              <div
                style={{
                  height: '100%',
                  border: '1px solid #EDEFF5',
                  borderRadius: 6,
                  padding: 14,
                  background: '#FBFCFE',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 4,
                      background: color.primary,
                      color: '#fff',
                      fontSize: 12,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {index + 1}
                  </span>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{action.title}</span>
                </div>
                <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.8, color: '#4B5563' }}>{action.detail}</div>
                <div style={{ marginTop: 8 }}>
                  <Tag color="blue">责任部门：{action.owner}</Tag>
                </div>
              </div>
            </Col>
          ))}
        </Row>
      </Card>

      <Footnote title="数据来源与口径">
        {data.caliber_note}
        <br />
        异动汇总 = 新店 +143.00 + 同店客流 +92.07 + 同店客单 +5.08 + 闭店 0.00 = 240.15 万元；收入变动（门店口径）= +240.28 万元，
        相差 0.13 万元为源表取整尾差，页面不改写任一数字。同店客流/客单影响合计 97.16 万，与同店收入变动 97.28 万相差 0.12 万。
      </Footnote>
    </div>
  )
}
