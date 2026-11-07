import { describe, expect, it } from 'vitest'
import type { WaterfallItemInput } from './waterfall'
import { buildWaterfall, hiddenBases, visibleValues } from './waterfall'

/** design.md 第 14 节：利润桥 9 项，64.60 → 112.70，合计 +48.10 */
const BRIDGE_ITEMS: WaterfallItemInput[] = [
  { key: 'revenue_scale', name: '收入规模', impact: 100.48 },
  { key: 'food_cost_rate', name: '食材成本率', impact: -10.42 },
  { key: 'discount_fee_rate', name: '优惠及手续费', impact: 12.93 },
  { key: 'utilities_rate', name: '水电气低值', impact: 2.17 },
  { key: 'marketing_rate', name: '宣传费用', impact: 7.39 },
  { key: 'salary', name: '工资奖金', impact: -12.03 },
  { key: 'dorm_rent', name: '宿舍房租', impact: -1.66 },
  { key: 'store_rent', name: '店铺房租', impact: -13.76 },
  { key: 'other_expense', name: '其它费用', impact: -37.0 },
]

describe('waterfall：利润桥数据转换', () => {
  const result = buildWaterfall(64.6, BRIDGE_ITEMS, 112.7)

  it('生成 起点 + 9 因素 + 终点 = 11 根柱子', () => {
    expect(result.data).toHaveLength(11)
    expect(result.data[0]).toMatchObject({
      key: '__start__',
      name: '基期营业利润',
      kind: 'total',
      base: 0,
      value: 64.6,
      running: 64.6,
      impact: null,
    })
    expect(result.data[10]).toMatchObject({
      key: '__end__',
      name: '本期营业利润',
      kind: 'total',
      base: 0,
      value: 112.7,
      running: 112.7,
      impact: null,
    })
  })

  it('正负因素分别计算透明底座与可见柱高度', () => {
    const revenue = result.data.find((item) => item.key === 'revenue_scale')!
    expect(revenue.kind).toBe('positive')
    expect(revenue.base).toBeCloseTo(64.6, 5)
    expect(revenue.value).toBeCloseTo(100.48, 5)
    expect(revenue.running).toBeCloseTo(165.08, 5)

    const food = result.data.find((item) => item.key === 'food_cost_rate')!
    expect(food.kind).toBe('negative')
    // 负向柱：底座 = 当前累计 + 影响（影响为负则底座下移），可见高度 = |影响|
    expect(food.base).toBeCloseTo(165.08 - 10.42, 5)
    expect(food.value).toBeCloseTo(10.42, 5)
    expect(food.running).toBeCloseTo(154.66, 5)
  })

  it('9 项影响合计 = 利润变动 48.10 万，尾差为 0', () => {
    expect(result.impactSum).toBeCloseTo(48.1, 2)
    expect(result.computedEnd).toBeCloseTo(112.7, 2)
    expect(Math.abs(result.tail)).toBeLessThan(0.005)
    expect(result.data[10].value).toBe(112.7)
  })

  it('所有可见柱高度 ≥ 0，标签带 ↑/↓ 与正负号', () => {
    expect(visibleValues(result).every((value) => value >= 0)).toBe(true)
    expect(hiddenBases(result)).toHaveLength(11)
    expect(result.data.find((item) => item.key === 'revenue_scale')!.label).toBe('↑ +100.48')
    expect(result.data.find((item) => item.key === 'food_cost_rate')!.label).toBe('↓ -10.42')
    expect(result.data.find((item) => item.key === 'other_expense')!.label).toBe('↓ -37.00')
    expect(result.data[0].label).toBe('64.60')
    expect(result.data[10].label).toBe('112.70')
  })

  it('尾差可见时暴露出来（97.17 套餐式场景）', () => {
    const withTail = buildWaterfall(760, [{ key: 'a', name: 'A', impact: 97.17 }], 857.28)
    expect(withTail.tail).toBeCloseTo(0.11, 2)
    expect(withTail.computedEnd).toBeCloseTo(857.17, 2)
  })
})
