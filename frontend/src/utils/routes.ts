/** 路由标题与菜单选中项映射（AppLayout 顶栏标题、侧边菜单高亮共用） */

interface RouteTitleRule {
  test: (pathname: string) => boolean
  title: string
  menuKey: string
}

const RULES: RouteTitleRule[] = [
  {
    test: (p) => p === '/revenue/store' || p.startsWith('/revenue/store/'),
    title: '门店详情',
    menuKey: '/revenue/same-store',
  },
  {
    test: (p) => p.startsWith('/revenue/channel/'),
    title: '渠道详情',
    menuKey: '/revenue/channel',
  },
  { test: (p) => p === '/revenue/structure', title: '收入结构', menuKey: '/revenue/structure' },
  { test: (p) => p === '/revenue/same-store', title: '同店异动', menuKey: '/revenue/same-store' },
  { test: (p) => p === '/revenue/channel', title: '渠道下钻', menuKey: '/revenue/channel' },
  { test: (p) => p === '/revenue/product', title: '产品下钻', menuKey: '/revenue/product' },
  { test: (p) => p === '/revenue/conclusion', title: '结论与计划', menuKey: '/revenue/conclusion' },
  { test: (p) => p === '/revenue', title: '收入分析', menuKey: '/revenue/structure' },
  { test: (p) => p === '/', title: '数据看板', menuKey: '/' },
  { test: (p) => p === '/profit', title: '营业利润分析', menuKey: '/profit' },
  { test: (p) => p === '/gross', title: '毛利分析', menuKey: '/gross' },
  { test: (p) => p === '/expense', title: '费用分析', menuKey: '/expense' },
  { test: (p) => p === '/customer', title: '顾客 & 竞争分析', menuKey: '/customer' },
  { test: (p) => p === '/summary', title: '总结 & 计划', menuKey: '/summary' },
  { test: (p) => p === '/sandbox', title: '沙盘预演', menuKey: '/sandbox' },
  { test: (p) => p === '/reports', title: '结果方案报告', menuKey: '/reports' },
  { test: (p) => p === '/data', title: '数据导入', menuKey: '/data' },
]

export function pageTitle(pathname: string): string {
  const rule = RULES.find((item) => item.test(pathname))
  return rule?.title ?? '餐饮经营分析'
}

export function selectedMenuKey(pathname: string): string {
  const rule = RULES.find((item) => item.test(pathname))
  return rule?.menuKey ?? '/'
}

export function isRevenuePath(pathname: string): boolean {
  return pathname === '/revenue' || pathname.startsWith('/revenue/')
}
