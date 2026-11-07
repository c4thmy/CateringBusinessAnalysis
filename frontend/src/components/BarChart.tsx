import ReactECharts from 'echarts-for-react'
import { useMemo } from 'react'
import { color } from '../theme'

export interface BarSeriesConfig {
  name: string
  values: number[]
  color: string
  /** 相同 stack 的系列会堆叠（用于量价影响拆解） */
  stack?: string
}

export interface BarChartProps {
  categories: string[]
  series: BarSeriesConfig[]
  height?: number
  horizontal?: boolean
  valueFormatter?: (value: number) => string
  unit?: string
  showLegend?: boolean
}

/** 通用柱状图：结构对比（本期/同期）与量价影响拆解共用；颜色只来自 theme */
export function BarChart({
  categories,
  series,
  height = 320,
  horizontal = false,
  valueFormatter,
  unit = '',
  showLegend = true,
}: BarChartProps) {
  const option = useMemo(() => {
    const categoryAxis = {
      type: 'category' as const,
      data: categories,
      axisTick: { show: false },
      axisLine: { lineStyle: { color: color.border } },
      axisLabel: {
        color: color.textSecondary,
        fontSize: 11,
        formatter: horizontal
          ? (value: string) => value
          : (value: string) => (value.length > 6 ? `${value.slice(0, 6)}…` : value),
      },
    }

    const valueAxis = {
      type: 'value' as const,
      name: unit ? `单位：${unit}` : undefined,
      nameTextStyle: { color: color.textTertiary, fontSize: 11 },
      splitLine: { lineStyle: { color: color.chartGrid } },
      axisLabel: {
        color: color.textTertiary,
        fontSize: 11,
        formatter: valueFormatter ? (value: number) => valueFormatter(value) : undefined,
      },
    }

    return {
      grid: { left: 8, right: 20, top: showLegend ? 34 : 16, bottom: 8, containLabel: true },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: showLegend
        ? {
            top: 0,
            right: 0,
            itemWidth: 10,
            itemHeight: 10,
            textStyle: { color: color.textSecondary, fontSize: 11 },
          }
        : undefined,
      xAxis: horizontal ? valueAxis : categoryAxis,
      yAxis: horizontal ? categoryAxis : valueAxis,
      series: series.map((item) => ({
        name: item.name,
        type: 'bar' as const,
        stack: item.stack,
        barMaxWidth: 18,
        data: item.values,
        itemStyle: {
          color: item.color,
          borderRadius: horizontal ? ([0, 3, 3, 0] as [number, number, number, number]) : 2,
        },
      })),
    } as unknown as Record<string, unknown>
  }, [categories, series, horizontal, valueFormatter, unit, showLegend])

  return (
    <div className="chart-wrap">
      <ReactECharts
        option={option}
        style={{ height }}
        opts={{ renderer: 'canvas' }}
        notMerge
      />
    </div>
  )
}
