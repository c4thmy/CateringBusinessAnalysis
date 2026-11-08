import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderPage } from '../test/render'
import { DashboardPage } from './dashboard/DashboardPage'
import { DataPage } from './data/DataPage'
import { LoginPage } from './login/LoginPage'
import { ProfitPage } from './profit/ProfitPage'
import { ChannelDetailPage } from './revenue/ChannelDetailPage'
import { ChannelPage } from './revenue/ChannelPage'
import { ConclusionPage } from './revenue/ConclusionPage'
import { ProductPage } from './revenue/ProductPage'
import { SameStorePage } from './revenue/SameStorePage'
import { StoreDetailPage } from './revenue/StoreDetailPage'
import { StructurePage } from './revenue/StructurePage'
import { GrossSkeletonPage, SandboxSkeletonPage } from './skeleton/SkeletonPages'

/** jsdom 没有 canvas，ECharts 统一替换成空组件；页面其余部分照常渲染与断言 */
vi.mock('echarts-for-react', () => ({
  default: () => null,
}))

async function expectText(text: string | RegExp) {
  const nodes = await screen.findAllByText(text)
  expect(nodes.length).toBeGreaterThan(0)
}

describe('页面冒烟：真实渲染 mock 数据', () => {
  it('经营总览：4 张 KPI + 利润桥 + 一句话结论', async () => {
    renderPage(<DashboardPage />)
    await expectText('营业收入')
    await expectText('1,000.00')
    await expectText('112.70')
    await expectText('73.3%')
    await expectText('12.8%')
    await expectText('↑ +240.00')
    await expectText('↑ +48.10')
    await expectText('利润桥：营业利润变动拆解')
    await expectText('一句话结论')
    await expectText(/四套收入合计分别标注/)
  })

  it('营业利润：利润表对比 + 利润桥 + 二期占位', async () => {
    renderPage(<ProfitPage />)
    await expectText('利润表对比')
    await expectText('食材成本')
    await expectText('营业利润')
    await expectText('↑ +48.10')
    const secondPhase = await screen.findAllByText('二期')
    expect(secondPhase).toHaveLength(3)
  })

  it('收入结构：默认渠道维度，美团大众 460 / +124 / 36.9%', async () => {
    renderPage(<StructurePage />)
    await expectText('收入结构对比')
    await expectText('美团大众')
    await expectText('460.00')
    await expectText('↑ +124.00')
    await expectText('46.0%')
    await expectText('↑ +36.9%')
  })

  it('同店异动：857.23、66,566.29、92.07 / 5.08 与尾差说明、13 店明细', async () => {
    renderPage(<SameStorePage />)
    await expectText('857.23')
    await expectText('66,566.29')
    await expectText('128.78')
    await expectText(/\+92\.07/)
    await expectText(/\+5\.08/)
    await expectText(/0\.12 万/)
    await expectText('门店12')
    await expectText('新店1')
  })

  it('门店详情：门店12 三项对比 + 时段客流（工作日 -465 / 节假日 +185）', async () => {
    renderPage(<StoreDetailPage />, { path: '/revenue/store/:storeId', route: '/revenue/store/12' })
    await expectText('门店12')
    await expectText('4,276.24')
    await expectText('4,556.15')
    await expectText('下降主因')
    await expectText('工作日')
    await expectText('节假日')
    await expectText('收入排名')
    await expectText(/工作日合计 -465 人次/)
  })

  it('渠道下钻：美团大众 460 / 336 / +124，同店 394.23 / 新店 65.77', async () => {
    renderPage(<ChannelPage />)
    await expectText('渠道结构表')
    await expectText('394.23')
    await expectText('65.77')
    await expectText('↑ +58.24')
    await expectText('↑ +124.00')
  })

  it('单渠道详情：漏斗人数 / 转化率 / 费用率与 ROI 阈值', async () => {
    renderPage(<ChannelDetailPage />, { path: '/revenue/channel/:channelId', route: '/revenue/channel/1' })
    await expectText('4,367,174')
    await expectText('639,025')
    await expectText(/14\.6%/)
    await expectText(/11\.4%/)
    await expectText(/88\.2%/)
    await expectText('平台费用率')
    await expectText('毛利 ROI')
    await expectText('2.00')
    await expectText('3.33')
    await expectText('访问-支付转化环比下降超 1pp')
  })

  it('产品下钻：系列量价 + 套餐量价（+770,933.33 / -392,795.79）', async () => {
    renderPage(<ProductPage />)
    await expectText('系列量价表')
    await expectText('肉类')
    await expectText('主食类')
    await expectText('444,217.54')
    await expectText('+770,933.33')
    await expectText('-392,795.79')
    await expectText('↑ +378,137.54')
    await expectText(/单品销售.*未导入/)
  })

  it('结论与计划：异动汇总 + 自动结论 + 3 条建议动作', async () => {
    renderPage(<ConclusionPage />)
    await expectText('新店贡献')
    await expectText('143.00')
    await expectText('三条建议动作（下月计划）')
    await expectText('巩固线上放量')
    await expectText(/240\.15/)
  })

  it('数据导入：数据集、模板占位、批次列表；错误文件时确认按钮禁用', async () => {
    renderPage(<DataPage />)
    await expectText('加载示例数据')
    await expectText('下载模板')
    await expectText('上传与校验（两阶段提交）')
    await expectText('导入批次（支持回滚）')
    expect(screen.queryByText('确认入库')).not.toBeInTheDocument()

    const input = document.querySelector('input[type="file"]')
    expect(input).not.toBeNull()
    const file = new File(['demo'], 'error.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    fireEvent.change(input as HTMLInputElement, { target: { files: [file] } })

    await screen.findByText('校验未通过：存在错误行，确认按钮已禁用')
    const confirm = screen.getByRole('button', { name: '确认入库' })
    await waitFor(() => expect(confirm).toBeDisabled())
  })

  it('骨架页：二期开放 + 规划清单 + 返回收入分析', async () => {
    renderPage(<GrossSkeletonPage />)
    await expectText('毛利分析')
    await expectText('一期为框架展示，二期开放')
    await expectText('返回收入分析')
    await expectText('毛利率变动拆分：产品销售结构影响 + 单品毛利率影响（mix_rate_split）')
  })

  it('沙盘骨架页：布局示意与不可用滑块', async () => {
    renderPage(<SandboxSkeletonPage />)
    await expectText('沙盘预演')
    await expectText('布局示意（不可计算）')
    await expectText('二期开放：实时利润表 + 利润桥 + 多方案对比')
  })

  it('登录页：演示账号提示', async () => {
    renderPage(<LoginPage />, { withAuth: true })
    await expectText('登录餐饮经营分析系统')
    await expectText('admin123')
  })
})
