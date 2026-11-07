/**
 * fetch 封装：VITE_API_MODE=mock 时走本地同形状 mock；real 时请求后端 /api。
 * 401 统一跳转登录页（路由守卫 + 接口兜底）。
 */
import { ApiError } from './errors'
import { mockRequest } from './mock'

export type ApiMode = 'mock' | 'real'

export const apiMode: ApiMode = import.meta.env.VITE_API_MODE === 'real' ? 'real' : 'mock'

const API_BASE: string = import.meta.env.VITE_API_BASE ?? '/api'

function redirectToLogin(): void {
  if (typeof window === 'undefined') return
  if (window.location.pathname.startsWith('/login')) return
  window.location.assign('/login')
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (apiMode === 'mock') {
    return mockRequest<T>(path, init)
  }

  const headers = new Headers(init?.headers)
  if (typeof init?.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      credentials: 'include',
      ...init,
      headers,
    })
  } catch {
    throw new ApiError(0, '网络异常：无法连接后端服务，请确认后端已启动（默认 127.0.0.1:8000）')
  }

  if (response.status === 401) {
    redirectToLogin()
    throw new ApiError(401, '未登录或登录已过期，请重新登录')
  }

  const body: unknown = await response.json().catch(() => null)

  if (!response.ok) {
    const detail =
      body && typeof body === 'object' && 'detail' in body
        ? String((body as { detail: unknown }).detail)
        : `请求失败（HTTP ${response.status}）`
    throw new ApiError(response.status, detail)
  }

  return body as T
}

/** 拼装查询串，忽略空值 */
export function toQuery(params: Record<string, string | number | null | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === '') continue
    search.set(key, String(value))
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}
