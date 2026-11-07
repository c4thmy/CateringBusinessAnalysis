import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { App as AntApp, ConfigProvider } from 'antd'
import type { ReactElement } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '../auth/AuthContext'
import { FilterProvider } from '../filters/FilterContext'

interface RenderPageOptions {
  /** 使用带参数的路由（如 /revenue/store/:storeId）时传入 */
  path?: string
  /** 初始 URL */
  route?: string
  /** 登录页等需要 AuthContext 时开启 */
  withAuth?: boolean
}

/**
 * 页面测试统一入口：QueryClient + MemoryRouter + FilterProvider + antd App 上下文。
 * 图表用 `vi.mock('echarts-for-react')` 在测试文件里替换，避免 jsdom 缺少 canvas。
 */
export function renderPage(ui: ReactElement, options: RenderPageOptions = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity, gcTime: Infinity },
    },
  })
  const route = options.route ?? options.path ?? '/'

  return render(
    <ConfigProvider>
      <AntApp>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={[route]}>
            <FilterProvider>
              {options.withAuth ? (
                <AuthProvider>
                  {options.path ? (
                    <Routes>
                      <Route path={options.path} element={ui} />
                    </Routes>
                  ) : (
                    ui
                  )}
                </AuthProvider>
              ) : options.path ? (
                <Routes>
                  <Route path={options.path} element={ui} />
                </Routes>
              ) : (
                ui
              )}
            </FilterProvider>
          </MemoryRouter>
        </QueryClientProvider>
      </AntApp>
    </ConfigProvider>,
  )
}
