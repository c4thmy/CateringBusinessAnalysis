/** react-query 查询/变更钩子：页面只调用这里，统一处理筛选参数与缓存 key。 */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { request, toQuery } from './client'
import type {
  ApiEnvelope,
  ChannelData,
  ChannelDetailData,
  ConclusionData,
  DataStatusData,
  Filters,
  ImportBatch,
  ImportTemplate,
  OverviewData,
  ProductData,
  ProfitData,
  SameStoreData,
  SeedLoadResult,
  StoreDetailData,
  StructureData,
  StructureDimension,
} from './types'

export const filterQueryKey = (filters: Filters) => [
  filters.brand,
  filters.store,
  filters.period,
  filters.mode,
  filters.baseline,
]

function filterQuery(filters: Filters): string {
  return toQuery({
    brand: filters.brand,
    store: filters.store,
    period: filters.period,
    mode: filters.mode,
    baseline: filters.baseline,
  })
}

export function useOverview(filters: Filters) {
  return useQuery<ApiEnvelope<OverviewData>>({
    queryKey: ['overview', ...filterQueryKey(filters)],
    queryFn: () => request<ApiEnvelope<OverviewData>>(`/analysis/overview${filterQuery(filters)}`),
    placeholderData: keepPreviousData,
  })
}

export function useProfit(filters: Filters) {
  return useQuery<ApiEnvelope<ProfitData>>({
    queryKey: ['profit', ...filterQueryKey(filters)],
    queryFn: () => request<ApiEnvelope<ProfitData>>(`/analysis/profit${filterQuery(filters)}`),
    placeholderData: keepPreviousData,
  })
}

export function useStructure(filters: Filters, dimension: StructureDimension) {
  return useQuery<ApiEnvelope<StructureData>>({
    queryKey: ['structure', dimension, ...filterQueryKey(filters)],
    queryFn: () =>
      request<ApiEnvelope<StructureData>>(
        `/analysis/revenue/structure${toQuery({
          dimension,
          brand: filters.brand,
          store: filters.store,
          period: filters.period,
          mode: filters.mode,
          baseline: filters.baseline,
        })}`,
      ),
    placeholderData: keepPreviousData,
  })
}

export function useSameStore(filters: Filters) {
  return useQuery<ApiEnvelope<SameStoreData>>({
    queryKey: ['same-store', ...filterQueryKey(filters)],
    queryFn: () => request<ApiEnvelope<SameStoreData>>(`/analysis/revenue/same-store${filterQuery(filters)}`),
    placeholderData: keepPreviousData,
  })
}

export function useStoreDetail(filters: Filters, storeId: number) {
  return useQuery<ApiEnvelope<StoreDetailData>>({
    queryKey: ['store-detail', storeId, ...filterQueryKey(filters)],
    queryFn: () =>
      request<ApiEnvelope<StoreDetailData>>(`/analysis/revenue/store/${storeId}${filterQuery(filters)}`),
    enabled: Number.isFinite(storeId) && storeId > 0,
    placeholderData: keepPreviousData,
  })
}

export function useChannel(filters: Filters) {
  return useQuery<ApiEnvelope<ChannelData>>({
    queryKey: ['channel', ...filterQueryKey(filters)],
    queryFn: () => request<ApiEnvelope<ChannelData>>(`/analysis/revenue/channel${filterQuery(filters)}`),
    placeholderData: keepPreviousData,
  })
}

export function useChannelDetail(filters: Filters, channelId: number) {
  return useQuery<ApiEnvelope<ChannelDetailData>>({
    queryKey: ['channel-detail', channelId, ...filterQueryKey(filters)],
    queryFn: () =>
      request<ApiEnvelope<ChannelDetailData>>(
        `/analysis/revenue/channel/${channelId}${filterQuery(filters)}`,
      ),
    enabled: Number.isFinite(channelId) && channelId > 0,
    placeholderData: keepPreviousData,
  })
}

export function useProduct(filters: Filters, scope: 'same_store' | 'all') {
  return useQuery<ApiEnvelope<ProductData>>({
    queryKey: ['product', scope, ...filterQueryKey(filters)],
    queryFn: () =>
      request<ApiEnvelope<ProductData>>(
        `/analysis/revenue/product${toQuery({
          scope,
          brand: filters.brand,
          store: filters.store,
          period: filters.period,
          mode: filters.mode,
          baseline: filters.baseline,
        })}`,
      ),
    placeholderData: keepPreviousData,
  })
}

export function useConclusion(filters: Filters) {
  return useQuery<ApiEnvelope<ConclusionData>>({
    queryKey: ['conclusion', ...filterQueryKey(filters)],
    queryFn: () => request<ApiEnvelope<ConclusionData>>(`/analysis/revenue/conclusion${filterQuery(filters)}`),
    placeholderData: keepPreviousData,
  })
}

export function useDataStatus(filters: Filters) {
  return useQuery<{ data: DataStatusData }>({
    queryKey: ['data-status', filters.period, filters.store],
    queryFn: () =>
      request<{ data: DataStatusData }>(
        `/data-status${toQuery({ period: filters.period, store: filters.store })}`,
      ),
    staleTime: 10_000,
  })
}

/* ---------------- 数据导入 ---------------- */

export function useTemplates() {
  return useQuery<{ data: ImportTemplate[] }>({
    queryKey: ['import-templates'],
    queryFn: () => request<{ data: ImportTemplate[] }>('/imports/templates'),
    staleTime: 5 * 60_000,
  })
}

export function useBatches() {
  return useQuery<{ data: ImportBatch[] }>({
    queryKey: ['import-batches'],
    queryFn: () => request<{ data: ImportBatch[] }>('/imports?limit=20'),
  })
}

export function useUploadImport() {
  const queryClient = useQueryClient()
  return useMutation<{ data: ImportBatch }, Error, { dataset: string; file: File }>({
    mutationFn: ({ dataset, file }) => {
      const form = new FormData()
      form.set('dataset', dataset)
      form.set('file', file)
      return request<{ data: ImportBatch }>('/imports', { method: 'POST', body: form })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['import-batches'] })
    },
  })
}

export function useCommitImport() {
  const queryClient = useQueryClient()
  return useMutation<{ data: ImportBatch }, Error, string>({
    mutationFn: (id) => request<{ data: ImportBatch }>(`/imports/${id}/commit`, { method: 'POST' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['import-batches'] })
      void queryClient.invalidateQueries({ queryKey: ['data-status'] })
    },
  })
}

export function useRollbackImport() {
  const queryClient = useQueryClient()
  return useMutation<{ data: ImportBatch }, Error, string>({
    mutationFn: (id) => request<{ data: ImportBatch }>(`/imports/${id}/rollback`, { method: 'POST' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['import-batches'] })
      void queryClient.invalidateQueries({ queryKey: ['data-status'] })
    },
  })
}

export function useLoadSeeds() {
  const queryClient = useQueryClient()
  return useMutation<{ data: SeedLoadResult }, Error, void>({
    mutationFn: () => request<{ data: SeedLoadResult }>('/seeds/load', { method: 'POST' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['data-status'] })
      void queryClient.invalidateQueries({ queryKey: ['import-batches'] })
    },
  })
}
