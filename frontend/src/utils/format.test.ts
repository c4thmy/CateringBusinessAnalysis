import { describe, expect, it } from 'vitest'
import {
  DASH,
  formatArrow,
  formatDelta,
  formatInteger,
  formatNumber,
  formatPercent,
  formatPp,
  formatShare,
  formatSignedNumber,
  formatSignedPercent,
  formatTicket,
  formatTraffic,
  formatWan,
  formatYuan,
  isNil,
} from './format'

describe('format：统一数字口径', () => {
  it('万元保留 2 位小数并带千分位', () => {
    expect(formatWan(1000)).toBe('1,000.00')
    expect(formatWan(240.4)).toBe('240.40')
    expect(formatWan(112.7)).toBe('112.70')
    expect(formatWan(-3.13)).toBe('-3.13')
    expect(formatWan(0)).toBe('0.00')
    // 不出现 -0.00
    expect(formatNumber(-0.001, 2)).toBe('0.00')
  })

  it('百分比保留 1 位小数', () => {
    expect(formatPercent(0.3158)).toBe('31.6%')
    expect(formatPercent(0.733)).toBe('73.3%')
    expect(formatPercent(0.1475)).toBe('14.8%')
    expect(formatPercent(0.128008)).toBe('12.8%')
    expect(formatPercent(-0.0528)).toBe('-5.3%')
    expect(formatPercent(0)).toBe('0.0%')
  })

  it('百分点差（pp）保留 2 位并带符号', () => {
    expect(formatPp(0.0104)).toBe('+1.04pp')
    expect(formatPp(-0.0104)).toBe('-1.04pp')
    expect(formatPp(0)).toBe('0.00pp')
    expect(formatPp(null)).toBe(DASH)
  })

  it('缺失值一律显示「—」', () => {
    expect(isNil(null)).toBe(true)
    expect(isNil(undefined)).toBe(true)
    expect(isNil(0)).toBe(false)
    expect(formatWan(null)).toBe(DASH)
    expect(formatPercent(undefined)).toBe(DASH)
    expect(formatTicket(null)).toBe(DASH)
    expect(formatTraffic(null)).toBe(DASH)
    expect(formatSignedNumber(null)).toBe(DASH)
  })

  it('带符号金额 / 百分比', () => {
    expect(formatSignedNumber(240)).toBe('+240.00')
    expect(formatSignedNumber(-13.76)).toBe('-13.76')
    expect(formatSignedNumber(0)).toBe('0.00')
    expect(formatSignedPercent(0.128008)).toBe('+12.8%')
  })

  it('差异文本 = 箭头 + 符号（色弱友好）', () => {
    expect(formatArrow(240)).toBe('↑')
    expect(formatArrow(-13.76)).toBe('↓')
    expect(formatArrow(0)).toBe('→')
    expect(formatArrow(null)).toBe('→')
    expect(formatDelta(240, 'currency')).toBe('↑ +240.00')
    expect(formatDelta(-0.0104, 'pp')).toBe('↓ -1.04pp')
    expect(formatDelta(0, 'pp')).toBe('→ 0.00pp')
    expect(formatDelta(-280, 'count')).toBe('↓ -280')
    expect(formatDelta(null, 'currency')).toBe(DASH)
  })

  it('客流 / 客单 / 元金额 / 占比', () => {
    expect(formatTraffic(66566.2912578113)).toBe('66,566.29')
    expect(formatTraffic(4276.24056711638)).toBe('4,276.24')
    expect(formatInteger(4276.24056711638)).toBe('4,276')
    expect(formatInteger(794)).toBe('794')
    expect(formatTicket(128.078392757371)).toBe('128.08')
    expect(formatYuan(444217.54)).toBe('444,217.54')
    expect(formatShare(0.46)).toBe('46.0%')
    expect(formatPercent(0.90658)).toBe('90.7%')
  })
})
