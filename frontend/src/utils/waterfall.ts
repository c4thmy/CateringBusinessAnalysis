/**
 * 利润桥（瀑布图）数据转换：把「起点 + 各因素影响 + 终点」转成 ECharts 堆叠柱所需的
 * [透明底座, 可见柱] 两段数据，并生成带 ↑/↓ 与正负号的标签（色弱友好）。
 * 纯函数，便于 vitest 单测（不依赖 echarts）。
 */
import { formatNumber, formatSignedNumber } from './format'

export interface WaterfallItemInput {
  key: string
  name: string
  impact: number
  kind?: 'positive' | 'negative'
  note?: string
}

export type WaterfallKind = 'total' | 'positive' | 'negative'

export interface WaterfallDatum {
  key: string
  name: string
  kind: WaterfallKind
  /** 透明底座的数值（堆叠柱第一段） */
  base: number
  /** 可见柱的高度（始终 ≥ 0） */
  value: number
  /** 该根柱子结束后的累计值（用于 tooltip 与断言） */
  running: number
  /** 因素影响额；起点/终点为 null */
  impact: number | null
  /** 柱顶标签：因素带箭头与符号，起点/终点为金额 */
  label: string
}

export interface WaterfallResult {
  data: WaterfallDatum[]
  /** 各因素影响之和 */
  impactSum: number
  /** 起点 + 影响之和（与终点比较可发现尾差） */
  computedEnd: number
  /** 终点 − 计算终点（源表取整尾差） */
  tail: number
}

export function buildWaterfall(
  start: number,
  items: WaterfallItemInput[],
  end: number,
  startLabel = '基期营业利润',
  endLabel = '本期营业利润',
): WaterfallResult {
  const data: WaterfallDatum[] = []
  let running = start

  data.push({
    key: '__start__',
    name: startLabel,
    kind: 'total',
    base: 0,
    value: start,
    running,
    impact: null,
    label: formatNumber(start),
  })

  for (const item of items) {
    const impact = item.impact
    let base: number
    let value: number
    let kind: WaterfallKind

    if (impact >= 0) {
      base = running
      value = impact
      kind = 'positive'
    } else {
      base = running + impact
      value = -impact
      kind = 'negative'
    }
    running += impact

    data.push({
      key: item.key,
      name: item.name,
      kind,
      base,
      value,
      running,
      impact,
      label: `${kind === 'positive' ? '↑ ' : '↓ '}${formatSignedNumber(impact)}`,
    })
  }

  data.push({
    key: '__end__',
    name: endLabel,
    kind: 'total',
    base: 0,
    value: end,
    running: end,
    impact: null,
    label: formatNumber(end),
  })

  const impactSum = items.reduce((sum, item) => sum + item.impact, 0)
  const computedEnd = start + impactSum

  return {
    data,
    impactSum,
    computedEnd,
    tail: end - computedEnd,
  }
}

/** ECharts 工具函数：取可见柱数据 */
export function visibleValues(result: WaterfallResult): number[] {
  return result.data.map((item) => item.value)
}

/** ECharts 工具函数：取透明底座数据（起点/终点为 0） */
export function hiddenBases(result: WaterfallResult): number[] {
  return result.data.map((item) => item.base)
}
