/**
 * 统一数字格式（验收口径）：
 * - 金额（万元 / 元）：2 位小数 + 千分位；
 * - 百分比：1 位小数；
 * - 百分点差（pp）：2 位小数，带正负号；
 * - 缺失值：一律显示「—」，禁止用 0 冒充（见 shared/api-contract.md）。
 */

export const DASH = '—'

export function isNil(value: number | null | undefined): value is null | undefined {
  return value === null || value === undefined || Number.isNaN(value)
}

/** 四舍五入到指定小数位，并把 -0.00 规范成 0.00 */
function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits
  const rounded = Math.round(value * factor) / factor
  if (Object.is(rounded, -0)) return 0
  if (Math.abs(value) < 0.5 / factor) return 0
  return rounded
}

/** 数字 + 千分位，digits 位小数；缺失返回「—」 */
export function formatNumber(value: number | null | undefined, digits = 2): string {
  if (isNil(value)) return DASH
  const fixed = roundTo(value, digits).toFixed(digits)
  const negative = fixed.startsWith('-')
  const [intPart, decPart] = (negative ? fixed.slice(1) : fixed).split('.')
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const text = decPart ? `${grouped}.${decPart}` : grouped
  return negative ? `-${text}` : text
}

/** 万元金额（2 位小数） */
export function formatWan(value: number | null | undefined, digits = 2): string {
  return formatNumber(value, digits)
}

/** 元金额（2 位小数） */
export function formatYuan(value: number | null | undefined, digits = 2): string {
  return formatNumber(value, digits)
}

/** 人次 / 件数（2 位小数，示例数据客流带小数） */
export function formatTraffic(value: number | null | undefined): string {
  return formatNumber(value, 2)
}

/** 整数计数（时段客流等） */
export function formatInteger(value: number | null | undefined): string {
  return formatNumber(value, 0)
}

/** 客单价 / 单价（元，2 位小数） */
export function formatTicket(value: number | null | undefined): string {
  return formatNumber(value, 2)
}

/** 比率（0–1 小数）转百分比字符串，保留 1 位小数；缺失返回「—」 */
export function formatPercent(value: number | null | undefined, digits = 1): string {
  if (isNil(value)) return DASH
  return `${formatNumber(value * 100, digits)}%`
}

/** 带符号的百分比（差异率等），保留 1 位小数 */
export function formatSignedPercent(value: number | null | undefined, digits = 1): string {
  if (isNil(value)) return DASH
  const text = formatNumber(value * 100, digits)
  return value > 0 ? `+${text}%` : `${text}%`
}

/** 带符号的金额/数值，保留 digits 位 */
export function formatSignedNumber(value: number | null | undefined, digits = 2): string {
  if (isNil(value)) return DASH
  const text = formatNumber(value, digits)
  return value > 0 ? `+${text}` : text
}

/** 百分点差异：入参是比率差（0.0104 → +1.04pp），保留 2 位 */
export function formatPp(value: number | null | undefined, digits = 2): string {
  if (isNil(value)) return DASH
  const text = formatNumber(value * 100, digits)
  return value > 0 ? `+${text}pp` : `${text}pp`
}

export type DeltaFormat = 'currency' | 'percent' | 'pp' | 'number' | 'count'

/** 涨跌箭头：颜色之外必须带 ↑/↓ 与正负号（色弱友好） */
export function formatArrow(value: number | null | undefined): string {
  if (isNil(value) || value === 0) return '→'
  return value > 0 ? '↑' : '↓'
}

/** 带箭头 + 符号的差异文本，例如 ↑ +240.00 / ↓ -1.04pp */
export function formatDelta(value: number | null | undefined, kind: DeltaFormat = 'number', digits?: number): string {
  if (isNil(value)) return DASH
  const arrow = formatArrow(value)
  let body: string
  switch (kind) {
    case 'percent':
      body = formatSignedPercent(value, digits ?? 1)
      break
    case 'pp':
      body = formatPp(value, digits ?? 2)
      break
    case 'count':
      body = formatSignedNumber(value, digits ?? 0)
      break
    case 'currency':
      body = formatSignedNumber(value, digits ?? 2)
      break
    case 'number':
    default:
      body = formatSignedNumber(value, digits ?? 2)
      break
  }
  return `${arrow} ${body}`
}

/** 占比（0–1）转「45.99%」，用于结构表占位列（保留 1 位，与百分比格式统一） */
export function formatShare(value: number | null | undefined): string {
  return formatPercent(value, 1)
}

/** 组合「金额 + 单位」，用于卡片副标题 */
export function formatWanWithUnit(value: number | null | undefined): string {
  return `${formatWan(value)} 万元`
}
