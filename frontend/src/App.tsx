import { Spin } from 'antd'
import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './layouts/AppLayout'
import { RequireAuth } from './auth/RequireAuth'

/** 页面按路由懒加载：ECharts 只随图表页进入，登录首屏更轻 */
const DashboardPage = lazy(() =>
  import('./pages/dashboard/DashboardPage').then((module) => ({ default: module.DashboardPage })),
)
const ProfitPage = lazy(() =>
  import('./pages/profit/ProfitPage').then((module) => ({ default: module.ProfitPage })),
)
const StructurePage = lazy(() =>
  import('./pages/revenue/StructurePage').then((module) => ({ default: module.StructurePage })),
)
const SameStorePage = lazy(() =>
  import('./pages/revenue/SameStorePage').then((module) => ({ default: module.SameStorePage })),
)
const StoreDetailPage = lazy(() =>
  import('./pages/revenue/StoreDetailPage').then((module) => ({ default: module.StoreDetailPage })),
)
const ChannelPage = lazy(() =>
  import('./pages/revenue/ChannelPage').then((module) => ({ default: module.ChannelPage })),
)
const ChannelDetailPage = lazy(() =>
  import('./pages/revenue/ChannelDetailPage').then((module) => ({ default: module.ChannelDetailPage })),
)
const ProductPage = lazy(() =>
  import('./pages/revenue/ProductPage').then((module) => ({ default: module.ProductPage })),
)
const ConclusionPage = lazy(() =>
  import('./pages/revenue/ConclusionPage').then((module) => ({ default: module.ConclusionPage })),
)
const DataPage = lazy(() =>
  import('./pages/data/DataPage').then((module) => ({ default: module.DataPage })),
)
const LoginPage = lazy(() =>
  import('./pages/login/LoginPage').then((module) => ({ default: module.LoginPage })),
)
const GrossSkeletonPage = lazy(() =>
  import('./pages/skeleton/SkeletonPages').then((module) => ({ default: module.GrossSkeletonPage })),
)
const ExpenseSkeletonPage = lazy(() =>
  import('./pages/skeleton/SkeletonPages').then((module) => ({ default: module.ExpenseSkeletonPage })),
)
const CustomerSkeletonPage = lazy(() =>
  import('./pages/skeleton/SkeletonPages').then((module) => ({ default: module.CustomerSkeletonPage })),
)
const SummarySkeletonPage = lazy(() =>
  import('./pages/skeleton/SkeletonPages').then((module) => ({ default: module.SummarySkeletonPage })),
)
const SandboxSkeletonPage = lazy(() =>
  import('./pages/skeleton/SkeletonPages').then((module) => ({ default: module.SandboxSkeletonPage })),
)
const ReportsSkeletonPage = lazy(() =>
  import('./pages/skeleton/SkeletonPages').then((module) => ({ default: module.ReportsSkeletonPage })),
)

function PageFallback() {
  return (
    <div style={{ minHeight: '50vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Spin size="large" description="页面加载中…">
        <div style={{ width: 180, height: 60 }} />
      </Spin>
    </div>
  )
}

export default function App() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireAuth />}>
          <Route element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="profit" element={<ProfitPage />} />
            <Route path="revenue/structure" element={<StructurePage />} />
            <Route path="revenue/same-store" element={<SameStorePage />} />
            <Route path="revenue/store/:storeId" element={<StoreDetailPage />} />
            <Route path="revenue/channel" element={<ChannelPage />} />
            <Route path="revenue/channel/:channelId" element={<ChannelDetailPage />} />
            <Route path="revenue/product" element={<ProductPage />} />
            <Route path="revenue/conclusion" element={<ConclusionPage />} />
            <Route path="gross" element={<GrossSkeletonPage />} />
            <Route path="expense" element={<ExpenseSkeletonPage />} />
            <Route path="customer" element={<CustomerSkeletonPage />} />
            <Route path="summary" element={<SummarySkeletonPage />} />
            <Route path="sandbox" element={<SandboxSkeletonPage />} />
            <Route path="reports" element={<ReportsSkeletonPage />} />
            <Route path="data" element={<DataPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  )
}
