import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { KpiCard } from './KpiCard'

describe('KpiCard：语义色、分位与缺失值', () => {
  it('食材成本率上升显示负向语义 + ↑ +1.04pp', () => {
    render(
      <KpiCard
        title="食材成本率"
        metric="food_cost_rate"
        value={0.267}
        valueFormat="percent"
        base={0.2566}
        diff={0.0104}
        diffFormat="pp"
      />,
    )
    expect(screen.getByText('食材成本率')).toBeInTheDocument()
    expect(screen.getByText('26.7%')).toBeInTheDocument()
    const delta = screen.getByText('↑ +1.04pp')
    expect(delta.className).toContain('delta')
    expect(delta.className).toContain('semantic-negative')
  })

  it('收入上升显示正向语义（↑ +240.00）', () => {
    render(
      <KpiCard
        title="营业收入"
        metric="revenue"
        value={1000}
        unit="万元"
        base={760}
        diff={240}
        diffFormat="currency"
      />,
    )
    const delta = screen.getByText('↑ +240.00')
    expect(delta.className).toContain('semantic-positive')
  })

  it('门店数不足（<3）时不显示分位行，改为提示', () => {
    render(
      <KpiCard
        title="综合毛利率"
        metric="gross_margin"
        value={0.73}
        valueFormat="percent"
        diff={-0.0104}
        diffFormat="pp"
        storeCount={2}
      />,
    )
    expect(screen.getByTestId('kpi-percentile-hint')).toHaveTextContent('门店数不足，无法计算分位')
    expect(screen.queryByText('P25')).not.toBeInTheDocument()
    expect(screen.queryByText('P75')).not.toBeInTheDocument()
  })

  it('分位数据齐全时展示 P25 / P50 / P75 与本店值', () => {
    render(
      <KpiCard
        title="综合毛利率"
        metric="gross_margin"
        value={0.733}
        valueFormat="percent"
        diff={-0.0104}
        diffFormat="pp"
        storeCount={13}
        percentiles={{ p25: 0.71, p50: 0.73, p75: 0.75, current: 0.733, bucket: 'P50–P75' }}
      />,
    )
    expect(screen.getByText('P25')).toBeInTheDocument()
    expect(screen.getByText('P50')).toBeInTheDocument()
    expect(screen.getByText('P75')).toBeInTheDocument()
    expect(screen.getByText(/本店 73\.3%/)).toBeInTheDocument()
  })

  it('缺失值显示「—」，且没有对比值时不渲染对比行', () => {
    render(<KpiCard title="同店增速" metric="same_store_growth" value={null} valueFormat="percent" />)
    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.queryByText(/同期/)).not.toBeInTheDocument()
  })
})
