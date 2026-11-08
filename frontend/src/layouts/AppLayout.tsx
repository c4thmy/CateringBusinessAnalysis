import { Alert, Button, Layout, Menu } from 'antd'
import type { MenuProps } from 'antd'
import { useMemo, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useDataStatus } from '../api/hooks'
import { useAuth } from '../auth/AuthContext'
import { AiAssistantFab } from '../components/AiAssistantFab'
import { FilterBar } from '../components/FilterBar'
import {
  CustomerIcon,
  DashboardIcon,
  DataIcon,
  ExpenseIcon,
  GrossIcon,
  ProfitIcon,
  ReportIcon,
  RevenueIcon,
  SandboxIcon,
  SummaryIcon,
} from '../components/icons'
import { useFilters } from '../filters/FilterContext'
import { layout } from '../theme'
import { pageTitle, selectedMenuKey } from '../utils/routes'
import { baselineLabel } from '../config/filters'

const NAV_ITEMS: MenuProps['items'] = [
  { key: '/', icon: <DashboardIcon />, label: '数据看板' },
  { key: '/profit', icon: <ProfitIcon />, label: '营业利润分析' },
  {
    key: '/revenue',
    icon: <RevenueIcon />,
    label: '收入分析',
    children: [
      { key: '/revenue/structure', label: '收入结构' },
      { key: '/revenue/same-store', label: '同店异动' },
      { key: '/revenue/channel', label: '渠道下钻' },
      { key: '/revenue/product', label: '产品下钻' },
      { key: '/revenue/conclusion', label: '结论与计划' },
    ],
  },
  { key: '/gross', icon: <GrossIcon />, label: '毛利分析' },
  { key: '/expense', icon: <ExpenseIcon />, label: '费用分析' },
  { key: '/customer', icon: <CustomerIcon />, label: '顾客 & 竞争分析' },
  { key: '/summary', icon: <SummaryIcon />, label: '总结 & 计划' },
  { key: '/sandbox', icon: <SandboxIcon />, label: '沙盘预演' },
  { key: '/reports', icon: <ReportIcon />, label: '结果方案报告' },
  { key: '/data', icon: <DataIcon />, label: '数据导入' },
]

export function AppLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { filters } = useFilters()
  // 收入分析子菜单默认展开（一期演示动线主要走收入链路）
  const [openKeys, setOpenKeys] = useState<string[]>(['/revenue'])
  const { data: statusPayload } = useDataStatus(filters)

  const title = pageTitle(location.pathname)
  const selectedKey = selectedMenuKey(location.pathname)

  const readiness = useMemo(() => {
    const status = statusPayload?.data
    if (!status) {
      return {
        loading: true,
        incomplete: false,
        missing: [] as string[],
        missingDatasets: [] as string[],
        readyCount: 0,
        totalCount: 0,
      }
    }
    const modules = Object.values(status.modules)
    const incomplete = modules.some((module) => !module.ready)
    const missing = Array.from(new Set(modules.flatMap((module) => module.missing)))
    const missingDatasets = status.datasets.filter((dataset) => !dataset.ready).map((dataset) => dataset.name)
    const readyCount = status.datasets.filter((dataset) => dataset.ready).length
    return {
      loading: false,
      incomplete,
      missing,
      missingDatasets,
      readyCount,
      totalCount: status.datasets.length,
    }
  }, [statusPayload])

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  const modeLabel = filters.mode === 'ytd' ? '累计' : '当月'
  const baselineText = filters.baseline === 'yoy' ? '同期' : `${baselineLabel(filters.baseline)}（二期）`

  return (
    <Layout className="app-layout">
      <Layout.Sider width={layout.siderWidth} theme="dark" className="app-sider">
        <div className="app-logo">
          <span className="app-logo-mark">P</span>
          <span className="app-logo-text">
            <span className="app-logo-title">Profit Pilot</span>
            <span className="app-logo-sub">餐饮经营分析</span>
          </span>
        </div>

        <div className="app-brand-switch" title="品牌切换（一期仅一个品牌，二期开放）">
          <span className="app-brand-switch-label">杨博鸡公煲</span>
          <span aria-hidden="true">⇄</span>
        </div>

        <div className="app-menu-scroll">
          <Menu
            theme="dark"
            mode="inline"
            items={NAV_ITEMS}
            selectedKeys={[selectedKey]}
            openKeys={openKeys}
            onOpenChange={(keys) => setOpenKeys(keys as string[])}
            onClick={({ key }) => {
              if (key.startsWith('/')) navigate(key)
            }}
            style={{ borderInlineEnd: 'none' }}
          />
        </div>

        <div className="app-sider-footer">
          <div className="app-data-status">
            <span className={`app-data-dot${readiness.incomplete ? ' is-incomplete' : ''}`} />
            <div>
              <div className="app-data-status-title">
                {readiness.loading ? '数据状态加载中' : readiness.incomplete ? '数据不完整' : '数据就绪'}
              </div>
              <div
                className="app-data-status-desc"
                title={
                  readiness.incomplete
                    ? `缺少数据集：${readiness.missing.join('、')}`
                    : readiness.missingDatasets.length > 0
                      ? `未导入：${readiness.missingDatasets.join('、')}`
                      : undefined
                }
              >
                {readiness.loading
                  ? '正在读取数据状态'
                  : readiness.incomplete
                    ? `${filters.period} · 缺 ${readiness.missing.slice(0, 2).join('、')}${
                        readiness.missing.length > 2 ? ' 等' : ''
                      }`
                    : `${filters.period} · ${readiness.readyCount}/${readiness.totalCount} 类数据集就绪`}
              </div>
            </div>
          </div>

          <div className="app-user">
            <span className="app-user-name">管理员 {user?.username ?? ''}</span>
            <Button type="text" size="small" style={{ color: 'rgba(255,255,255,0.75)' }} onClick={() => void handleLogout()}>
              退出
            </Button>
          </div>
        </div>
      </Layout.Sider>

      <Layout>
        <Layout.Header className="app-header">
          <div className="app-page-title">
            <span className="app-title-bar" />
            <h1>{title}</h1>
            <span className="app-page-subtitle">
              {filters.period} · {modeLabel} · 对比{baselineText}
            </span>
          </div>
          <FilterBar />
        </Layout.Header>

        <Layout.Content className="app-content">
          {filters.mode === 'ytd' && location.pathname.startsWith('/revenue') ? (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 12 }}
              title="收入分析累计口径二期开放"
              description="当前收入页按当月展示；如需累计请先补齐月度门店/渠道数据，二期开放后再切换。"
            />
          ) : null}
          <Outlet />
        </Layout.Content>
      </Layout>

      <AiAssistantFab />
    </Layout>
  )
}
