import { describe, expect, it } from 'vitest'
import { color } from '../theme'
import {
  getMetric,
  goodDirectionLabel,
  isUpGood,
  semanticClass,
  semanticColor,
  semanticFromDiff,
  semanticOf,
} from './metrics'

describe('metrics：语义色必须看指标好坏方向，而不是数值正负', () => {
  it('成本率上升是负向（26.70% ← 25.66%，+1.04pp）', () => {
    expect(semanticOf('food_cost_rate', 0.0104)).toBe('negative')
    expect(semanticColor(semanticOf('food_cost_rate', 0.0104))).toBe(color.negative)
    expect(semanticClass(semanticOf('food_cost_rate', 0.0104))).toBe('semantic-negative')
    expect(isUpGood('food_cost_rate')).toBe(false)
  })

  it('成本率下降是正向', () => {
    expect(semanticOf('food_cost_rate', -0.0104)).toBe('positive')
  })

  it('收入上升是正向，收入下降是负向', () => {
    expect(semanticOf('revenue', 240)).toBe('positive')
    expect(semanticOf('revenue', -240)).toBe('negative')
    expect(isUpGood('revenue')).toBe(true)
  })

  it('固定费用增加是负向（其它费用 +37.00 万）', () => {
    expect(semanticOf('other_expense', 37)).toBe('negative')
    expect(semanticOf('store_rent', -13.76)).toBe('positive')
  })

  it('零差异与缺失为持平', () => {
    expect(semanticFromDiff(0, 'up')).toBe('flat')
    expect(semanticFromDiff(null, 'down')).toBe('flat')
    expect(semanticColor('flat')).toBe(color.neutral)
  })

  it('指标元数据包含单位与默认格式', () => {
    expect(getMetric('gross_margin')?.format).toBe('percent')
    expect(getMetric('gross_margin')?.deltaFormat).toBe('pp')
    expect(getMetric('revenue')?.unit).toBe('万元')
    expect(getMetric('traffic')?.unit).toBe('人次')
    expect(getMetric('unknown_metric')).toBeNull()
    expect(goodDirectionLabel('fee_rate')).toBe('越低越好')
    expect(goodDirectionLabel('gross_roi')).toBe('越高越好')
  })
})
