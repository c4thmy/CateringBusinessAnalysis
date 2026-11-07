/**
 * mock 路由：与 shared/api-contract.md 同形状（data/meta/insights、data-status {data}、imports {data}）。
 * 数字见 ./data.ts 顶部注释（design.md 第 14 节 + Excel 明细提取，不自造）。
 */
import { ApiError } from '../errors'
import type {
  ApiEnvelope,
  AuthUser,
  Baseline,
  ChannelData,
  ChannelDetailData,
  ConclusionData,
  DataStatusData,
  Filters,
  ImportBatch,
  ImportErrorRow,
  ImportPreviewRow,
  ImportTemplate,
  Insight,
  OverviewData,
  ProductData,
  ProfitData,
  SameStoreData,
  SeedLoadResult,
  StoreDetailData,
  StructureData,
  StructureDimension,
} from '../types'
import {
  buildDataStatus,
  channelData,
  conclusionData,
  datasetNames,
  getChannelDetail,
  getStoreDetail,
  importErrorSample,
  importPreviews,
  initialBatches,
  insights,
  overviewMonth,
  overviewYtd,
  productAll,
  productSameStore,
  profitMonth,
  profitYtd,
  sameStore,
  structures,
  templates,
} from './data'

const MOCK_USER_KEY = 'cba.mock.user'
const VALID_DIMENSIONS: StructureDimension[] = [
  'business_model',
  'store_type',
  'region',
  'channel',
  'channel_category',
  'series',
]

const batches: ImportBatch[] = initialBatches.map((item) => ({ ...item }))

function mockDelay(): Promise<void> {
  const delay = import.meta.env.MODE === 'test' ? 0 : 120
  return new Promise((resolve) => setTimeout(resolve, delay))
}

function parseFilters(query: URLSearchParams): Filters {
  const mode = query.get('mode') === 'ytd' ? 'ytd' : 'month'
  const baselineParam = query.get('baseline')
  const baseline: Baseline =
    baselineParam === 'budget' || baselineParam === 'mom' ? baselineParam : 'yoy'
  return {
    brand: query.get('brand') ?? 'all',
    store: query.get('store') ?? 'all',
    period: query.get('period') ?? '2025-09',
    mode,
    baseline,
  }
}

function buildEnvelope<T>(data: T, filters: Filters, insightList: Insight[]): ApiEnvelope<T> {
  return {
    data: structuredClone(data),
    meta: {
      brand: filters.brand,
      store: filters.store,
      period: filters.period,
      baseline: filters.baseline,
      unit: '万元',
      mode: filters.mode,
    },
    insights: structuredClone(insightList),
  }
}

/** mock 只提供 2025-09 数据；其它期间返回 404，由页面展示空态（真实后端同样返回错误） */
function assertPeriod(filters: Filters): void {
  if (filters.period !== '2025-09') {
    throw new ApiError(
      404,
      `期间 ${filters.period} 未导入数据：请先在「数据导入」上传该期间的 8 类数据集，或在顶部筛选切回 2025-09。`,
    )
  }
}

function readMockUser(): AuthUser | null {
  if (typeof localStorage === 'undefined') return null
  const raw = localStorage.getItem(MOCK_USER_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as AuthUser
    return parsed?.username ? parsed : null
  } catch {
    return null
  }
}

async function readJsonBody(init?: RequestInit): Promise<Record<string, unknown>> {
  if (!init?.body || typeof init.body !== 'string') return {}
  try {
    return JSON.parse(init.body) as Record<string, unknown>
  } catch {
    return {}
  }
}

function findBatch(id: string): ImportBatch {
  const batch = batches.find((item) => item.id === id)
  if (!batch) throw new ApiError(404, `导入批次 ${id} 不存在`)
  return batch
}

function previewFor(dataset: string): ImportPreviewRow[] {
  return (importPreviews[dataset] ?? []).map((row) => ({ ...row }))
}

export async function mockRequest<T>(path: string, init?: RequestInit): Promise<T> {
  await mockDelay()

  const method = (init?.method ?? 'GET').toUpperCase()
  const url = new URL(path, 'http://mock.local')
  // 与后端一致：真实接口在 /api/analysis/* 下；mock 内部按去掉 /analysis 的路径匹配
  const pathname = url.pathname.replace(/^\/analysis(?=\/revenue)/, '')
  const query = url.searchParams
  const filters = parseFilters(query)

  /* ---------------- 认证 ---------------- */
  if (pathname === '/auth/login' && method === 'POST') {
    const body = await readJsonBody(init)
    const username = String(body.username ?? '')
    const password = String(body.password ?? '')
    if (username !== 'admin' || password !== 'admin123') {
      throw new ApiError(401, '用户名或密码不正确（演示账号 admin / admin123）')
    }
    const user: AuthUser = { username: 'admin' }
    localStorage.setItem(MOCK_USER_KEY, JSON.stringify(user))
    return user as T
  }

  if (pathname === '/auth/me' && method === 'GET') {
    const user = readMockUser()
    if (!user) throw new ApiError(401, '未登录')
    return user as T
  }

  if (pathname === '/auth/logout' && method === 'POST') {
    localStorage.removeItem(MOCK_USER_KEY)
    return { ok: true } as T
  }

  /* ---------------- 数据状态 ---------------- */
  if (pathname === '/data-status' && method === 'GET') {
    const period = query.get('period') ?? '2025-09'
    const payload: DataStatusData = buildDataStatus(period)
    return { data: payload } as T
  }

  /* ---------------- 导入 ---------------- */
  if (pathname === '/imports/templates' && method === 'GET') {
    const payload: ImportTemplate[] = structuredClone(templates)
    return { data: payload } as T
  }

  if (pathname === '/imports' && method === 'GET') {
    return { data: structuredClone(batches) } as T
  }

  if (pathname === '/imports' && method === 'POST') {
    let dataset = 'pl'
    let filename = '上传文件.xlsx'
    if (init?.body instanceof FormData) {
      dataset = String(init.body.get('dataset') ?? 'pl')
      const file = init.body.get('file')
      if (file instanceof File) filename = file.name
    }
    const dbError = /error|错误/i.test(filename)
    const frontErrors: ImportErrorRow[] = dbError ? structuredClone(importErrorSample) : []
    const preview = previewFor(dataset)
    const batch: ImportBatch = {
      id: `IMP-${Date.now()}`,
      dataset,
      dataset_name: datasetNames[dataset] ?? dataset,
      filename,
      period: '2025-09',
      row_count: preview.length,
      operator: 'admin',
      created_at: new Date().toLocaleString('zh-CN', { hour12: false }),
      status: 'draft',
      errors: frontErrors,
      preview,
    }
    batches.unshift(batch)
    return { data: structuredClone(batch) } as T
  }

  const commitMatch = pathname.match(/^\/imports\/([^/]+)\/commit$/)
  if (commitMatch && method === 'POST') {
    const batch = findBatch(decodeURIComponent(commitMatch[1]))
    if (batch.status !== 'draft') throw new ApiError(400, '只有草稿批次可以确认入库')
    const errors = (batch.errors ?? []).filter((item) => item.severity === 'error')
    if (errors.length > 0) throw new ApiError(400, '存在校验错误，不能确认入库')
    batch.status = 'committed'
    batch.row_count = (batch.preview ?? []).length || batch.row_count
    return { data: structuredClone(batch) } as T
  }

  const rollbackMatch = pathname.match(/^\/imports\/([^/]+)\/rollback$/)
  if (rollbackMatch && method === 'POST') {
    const batch = findBatch(decodeURIComponent(rollbackMatch[1]))
    if (batch.status !== 'committed') throw new ApiError(400, '只有已入库批次可以回滚')
    batch.status = 'rolled_back'
    return { data: structuredClone(batch) } as T
  }

  if (pathname === '/seeds/load' && method === 'POST') {
    const result: SeedLoadResult = {
      ok: true,
      datasets: 8,
      message: '示例数据已加载（mock 演示：不写库；2025-09 数据已就绪）',
    }
    return { data: result } as T
  }

  /* ---------------- 分析接口 ---------------- */
  if (pathname === '/analysis/overview' && method === 'GET') {
    assertPeriod(filters)
    const payload: OverviewData = filters.mode === 'ytd' ? overviewYtd : overviewMonth
    return buildEnvelope(payload, filters, insights.overview) as T
  }

  if (pathname === '/analysis/profit' && method === 'GET') {
    assertPeriod(filters)
    const payload: ProfitData = filters.mode === 'ytd' ? profitYtd : profitMonth
    const level = filters.mode === 'ytd' ? 'info' : 'positive'
    return buildEnvelope(payload, filters, [{ ...insights.profit[0], level } as Insight, ...insights.profit.slice(1)]) as T
  }

  if (pathname === '/revenue/structure' && method === 'GET') {
    assertPeriod(filters)
    const dimension = (query.get('dimension') ?? 'channel') as StructureDimension
    if (!VALID_DIMENSIONS.includes(dimension)) {
      throw new ApiError(400, `不支持的结构维度：${dimension}`)
    }
    const payload: StructureData = structures[dimension]
    return buildEnvelope(payload, filters, insights.structure) as T
  }

  if (pathname === '/revenue/same-store' && method === 'GET') {
    assertPeriod(filters)
    const payload: SameStoreData = sameStore
    return buildEnvelope(payload, filters, insights.same_store) as T
  }

  const storeMatch = pathname.match(/^\/revenue\/store\/(\d+)$/)
  if (storeMatch && method === 'GET') {
    assertPeriod(filters)
    const storeId = Number(storeMatch[1])
    const payload: StoreDetailData | null = getStoreDetail(storeId)
    if (!payload) throw new ApiError(404, `门店 ${storeId} 不存在`)
    const insightList = storeId === 12 ? insights.store12 : insights.same_store
    return buildEnvelope(payload, filters, insightList) as T
  }

  if (pathname === '/revenue/channel' && method === 'GET') {
    assertPeriod(filters)
    const payload: ChannelData = channelData
    return buildEnvelope(payload, filters, insights.channel) as T
  }

  const channelMatch = pathname.match(/^\/revenue\/channel\/(\d+)$/)
  if (channelMatch && method === 'GET') {
    assertPeriod(filters)
    const channelId = Number(channelMatch[1])
    const payload: ChannelDetailData | null = getChannelDetail(channelId)
    if (!payload) throw new ApiError(404, `渠道 ${channelId} 不存在`)
    const insightList = payload.funnel ? insights.channelDetail : insights.channel
    return buildEnvelope(payload, filters, insightList) as T
  }

  if (pathname === '/revenue/product' && method === 'GET') {
    assertPeriod(filters)
    const scope = query.get('scope') === 'all' ? 'all' : 'same_store'
    const payload: ProductData = scope === 'all' ? productAll : productSameStore
    return buildEnvelope(payload, filters, insights.product) as T
  }

  if (pathname === '/revenue/conclusion' && method === 'GET') {
    assertPeriod(filters)
    const payload: ConclusionData = conclusionData
    return buildEnvelope(payload, filters, insights.conclusion) as T
  }

  throw new ApiError(404, `mock 未实现接口：${method} ${pathname}`)
}
