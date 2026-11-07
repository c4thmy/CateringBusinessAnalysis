import ReactECharts from 'echarts-for-react'
import { useMemo } from 'react'
import type { BridgeItem } from '../api/types'
import { color } from '../theme'
import { formatNumber, formatSignedNumber } from '../utils/format'
import { buildWaterfall } from '../utils/waterfall'

export interface WaterfallProps {
  start: number
  end: number
  items: BridgeItem[]
  height?: number
  startLabel?: string
  endLabel?: string
  unit?: string
}

interface AxisTooltipParam {
  dataIndex?: number
}

/**
 * 利润桥瀑布图：ECharts 堆叠柱实现（透明底座 + 可见柱）。
 * 颜色之外柱顶标签带 ↑/↓ 与正负号，满足色弱友好要求。
 */
export function Waterfall({
  start,
  end,
  items,
  height = 360,
  startLabel = '基期营业利润',
  endLabel = '本期营业利润',
  unit = '万元',
}: WaterfallProps) {
  const result = useMemo(
    () => buildWaterfall(start, items, end, startLabel, endLabel),
    [start, end, items, startLabel, endLabel],
  )

  const option = useMemo(() => {
    const categories = result.data.map((item) => item.name)
    const bases = result.data.map((item) => item.base)
    const bars = result.data.map((item) => {
      const barColor =
        item.kind === 'total'
          ? color.chartBlue
          : item.kind === 'positive'
            ? color.positiveBar
            : color.negativeBar
      return {
        value: item.value,
        itemStyle: {
          color: barColor,
          borderRadius: item.kind === 'total' ? 2 : ([2, 2, 0, 0] as [number, number, number, number]),
        },
        label: {
          show: true,
          position: 'top' as const,
          color: barColor,
          fontSize: 11,
          fontWeight: 600,
          formatter: item.label,
        },
      }
    })

    return {
      grid: { left: 8, right: 12, top: 42, bottom: 52, containLabel: true },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: unknown) => {
          const list = Array.isArray(params) ? params : [params]
          const first = list[0] as AxisTooltipParam | undefined
          const index = first?.dataIndex ?? 0
          const datum = result.data[index]
          if (!datum) return ''
          if (datum.impact === null) {
            return `${datum.name}<br/>${formatNumber(datum.value)} ${unit}`
          }
          return `${datum.name}<br/>影响 ${formatSignedNumber(datum.impact)} ${unit}<br/>累计 ${formatNumber(datum.running)} ${unit}`
        },
      },
      xAxis: {
        type: 'category',
        data: categories,
        axisTick: { show: false },
        axisLine: { lineStyle: { color: color.border } },
        axisLabel: { interval: 0, rotate: 28, color: color.textSecondary, fontSize: 11 },
      },
      yAxis: {
        type: 'value',
        name: `单位：${unit}`,
        nameTextStyle: { color: color.textTertiary, fontSize: 11, align: 'left' },
        splitLine: { lineStyle: { color: color.chartGrid } },
        axisLabel: { color: color.textTertiary, fontSize: 11 },
      },
      series: [
        {
          name: '占位',
          type: 'bar',
          stack: 'waterfall',
          silent: true,
          itemStyle: { color: 'transparent' },
          emphasis: { itemStyle: { color: 'transparent' } },
          data: bases,
        },
        {
          name: '影响',
          type: 'bar',
          stack: 'waterfall',
          barMaxWidth: 34,
          data: bars,
          markLine: {
            silent: true,
            symbol: 'none',
            label: { show: false },
            lineStyle: { type: 'dashed', color: color.chartGray, width: 1 },
            data: [{ yAxis: start }, { yAxis: end }],
          },
        },
      ],
    } as unknown as Record<string, unknown>
  }, [result, start, end, unit])

  return (
    <div className="chart-wrap">
      <ReactECharts
        // echarts-for-react 的 option 类型宽松，这里传普通对象即可
        option={option}
        style={{ height }}
        opts={{ renderer: 'canvas' }}
        notMerge
      />
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
          paddingLeft: 8,
          fontSize: 12,
          color: color.textTertiary,
        }}
      >
        <LegendItem color={color.chartBlue} label="营业利润（起点 / 终点）" />
        <LegendItem color={color.positiveBar} label="正向影响 ↑" />
        <LegendItem color={color.negativeBar} label="负向影响 ↓" />
        <span style={{ marginLeft: 'auto' }}>
          因素影响合计 {formatSignedNumber(result.impactSum)} 万元
          {Math.abs(result.tail) >= 0.005 ? `（与利润变动尾差 ${formatNumber(result.tail)} 万元）` : ''}
        </span>
      </div>
    </div>
  )
}

function LegendItem({ color: swatchColor, label }: { color: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 10, height: 10, borderRadius: 2, background: swatchColor }} />
      {label}
    </span>
  )
}
