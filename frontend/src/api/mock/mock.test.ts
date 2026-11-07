import { describe, expect, it } from 'vitest'
import type {
  ApiEnvelope,
  ChannelData,
  ChannelDetailData,
  ConclusionData,
  OverviewData,
  ProductData,
  SameStoreData,
} from '../types'
import { mockRequest } from './index'

/**
 * 这一组测试把 mock 数字锁到 design.md 第 14 节验收数字：
 * 任何页面展示的 mock 数据都必须来自这里，避免自造数字。
 */
describe('mock 数据 = design.md 第 14 节验收数字', () => {
  it('总览 KPI：1000.00/760.00、112.70/64.60、73.30%/74.34%、同店增速 12.80%', async () => {
    const res = await mockRequest<ApiEnvelope<OverviewData>>('/analysis/overview?period=2025-09')
    expect(res.data.kpis.revenue).toMatchObject({ value: 1000, base: 760, diff: 240 })
    expect(res.data.kpis.profit).toMatchObject({ value: 112.7, base: 64.6, diff: 48.1 })
    expect(res.data.kpis.gross_margin.value).toBeCloseTo(0.733, 4)
    expect(res.data.kpis.gross_margin.base).toBeCloseTo(0.7434, 4)
    expect(res.data.kpis.gross_margin.diff).toBeCloseTo(-0.0104, 4)
    expect(res.data.kpis.same_store_growth.value).toBeCloseTo(0.128008, 5)
    expect(res.data.profit_bridge.start).toBe(64.6)
    expect(res.data.profit_bridge.end).toBe(112.7)
  })

  it('利润桥 9 项因素与合计 +48.10', async () => {
    const res = await mockRequest<ApiEnvelope<OverviewData>>('/analysis/overview?period=2025-09')
    const impacts = Object.fromEntries(
      res.data.profit_bridge.items.map((item) => [item.key, item.impact]),
    )
    expect(res.data.profit_bridge.items).toHaveLength(9)
    expect(impacts).toMatchObject({
      revenue_scale: 100.48,
      food_cost_rate: -10.42,
      discount_fee_rate: 12.93,
      utilities_rate: 2.17,
      marketing_rate: 7.39,
      salary: -12.03,
      dorm_rent: -1.66,
      store_rent: -13.76,
      other_expense: -37.0,
    })
    const sum = res.data.profit_bridge.items.reduce((total, item) => total + item.impact, 0)
    expect(sum).toBeCloseTo(48.1, 2)
  })

  it('同店：857.23 / 759.95，客流 66,566.29、客单 128.78，影响 92.07 / 5.08 与 0.12 尾差', async () => {
    const res = await mockRequest<ApiEnvelope<SameStoreData>>('/revenue/same-store?period=2025-09')
    const summary = res.data.summary
    expect(summary.current).toBe(857.23)
    expect(summary.base).toBe(759.95)
    expect(summary.diff).toBe(97.28)
    expect(summary.traffic.current).toBe(66566.29)
    expect(summary.traffic.base).toBe(59344.75)
    expect(summary.ticket.current).toBe(128.78)
    expect(summary.ticket.base).toBe(128.08)
    expect(summary.traffic_impact).toBe(92.07)
    expect(summary.ticket_impact).toBe(5.08)
    expect(summary.impact_sum).toBe(97.16)
    expect(summary.variance_note).toContain('0.12 万')
    expect(res.data.stores).toHaveLength(13)
    expect(res.data.new_stores.map((item) => item.revenue)).toEqual([80, 63])
  })

  it('渠道：美团大众 460/336/+124/+36.9%，同店 394.23 / 新店 65.77', async () => {
    const res = await mockRequest<ApiEnvelope<ChannelData>>('/revenue/channel?period=2025-09')
    const meituan = res.data.rows[0]
    expect(meituan).toMatchObject({ name: '美团大众', current: 460, base: 336, diff: 58.24 })
    expect(meituan.current - meituan.base).toBe(124)
    expect(meituan.current / meituan.base - 1).toBeCloseTo(0.369, 3)
    expect(meituan.rate).toBeCloseTo(0.1733, 4)
    expect(meituan.same_store).toBe(394.23)
    expect(meituan.new_store).toBe(65.77)
    expect(res.data.total.current).toBe(1000)
    expect(res.data.total.base).toBe(759.56)
    expect(res.data.rows).toHaveLength(10)
  })

  it('漏斗 4,367,174 → 639,025（14.63%）→ 73,113（11.44%）→ 64,468（88.18%），ROI 2.00 / 3.33', async () => {
    const res = await mockRequest<ApiEnvelope<ChannelDetailData>>('/revenue/channel/1?period=2025-09')
    expect(res.data.funnel).toMatchObject({
      exposure: 4367174,
      visits: 639025,
      payers: 73113,
      consumers: 64468,
      exposure_visit: 0.1463,
      visit_pay: 0.1144,
      pay_consume: 0.8818,
    })
    expect(res.data.economics).toMatchObject({
      revenue: 460,
      platform_fee: 138,
      fee_rate: 0.3,
      gross_roi: 2,
      sales_roi: 3.33,
    })
    expect(res.data.economics?.thresholds).toMatchObject({
      fee_rate: 0.15,
      gross_roi: 1,
      sales_roi: 4,
    })
  })

  it('套餐量价：432/66,080/152.96 → 5,472/444,217.54/81.18，量差 +770,933.33、价差 -392,795.79', async () => {
    const res = await mockRequest<ApiEnvelope<ProductData>>('/revenue/product?scope=same_store')
    expect(res.data.sets.base).toMatchObject({ qty: 432, amount: 66080, avg_price: 152.96 })
    expect(res.data.sets.current).toMatchObject({ qty: 5472, amount: 444217.54, avg_price: 81.18 })
    expect(res.data.sets.qty_impact).toBe(770933.33)
    expect(res.data.sets.price_impact).toBe(-392795.79)
    expect(res.data.sets.diff).toBe(378137.54)
    expect(res.data.total.qty_impact).toBe(91.5)
    expect(res.data.total.price_impact).toBe(5.67)
    expect(res.data.series.find((item) => item.name === '肉类')).toMatchObject({
      qty_impact: 58.56,
      price_impact: 21.44,
    })
  })

  it('结论汇总：新店 143、同店客流 92.07、同店客单 5.08，合计 240.15 vs 240.28', async () => {
    const res = await mockRequest<ApiEnvelope<ConclusionData>>('/revenue/conclusion?period=2025-09')
    expect(res.data.summary).toMatchObject({
      new_store: 143,
      same_store_traffic: 92.07,
      same_store_ticket: 5.08,
      closed_store: 0,
      impact_sum: 240.15,
      total_diff: 240.28,
    })
    expect(res.data.summary.variance_note).toContain('0.13 万')
    expect(res.data.actions).toHaveLength(3)
  })

  it('期间未导入返回 404；未登录 /auth/me 返回 401', async () => {
    await expect(mockRequest('/analysis/overview?period=2025-08')).rejects.toMatchObject({ status: 404 })
    await expect(mockRequest('/auth/me')).rejects.toMatchObject({ status: 401 })
  })

  it('登录成功 / 退出（演示账号 admin / admin123）', async () => {
    const user = await mockRequest<{ username: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'admin', password: 'admin123' }),
    })
    expect(user.username).toBe('admin')
    const me = await mockRequest<{ username: string }>('/auth/me')
    expect(me.username).toBe('admin')
    await expect(
      mockRequest('/auth/login', { method: 'POST', body: JSON.stringify({ username: 'admin', password: 'wrong' }) }),
    ).rejects.toMatchObject({ status: 401 })
    await mockRequest('/auth/logout', { method: 'POST' })
    await expect(mockRequest('/auth/me')).rejects.toMatchObject({ status: 401 })
  })
})
