import { createContext, useCallback, useContext, useMemo } from 'react'
import type { ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { Baseline, Filters, PeriodMode } from '../api/types'
import { DEFAULT_FILTERS } from '../config/filters'

interface FilterContextValue {
  filters: Filters
  /** 局部更新筛选条件；值写入 URL（刷新后保留） */
  setFilters: (patch: Partial<Filters>) => void
  resetFilters: () => void
}

const FilterContext = createContext<FilterContextValue | null>(null)

function parseFilters(searchParams: URLSearchParams): Filters {
  const mode: PeriodMode = searchParams.get('mode') === 'ytd' ? 'ytd' : 'month'
  const baselineParam = searchParams.get('baseline')
  const baseline: Baseline =
    baselineParam === 'budget' || baselineParam === 'mom' ? baselineParam : 'yoy'
  return {
    brand: searchParams.get('brand') ?? DEFAULT_FILTERS.brand,
    store: searchParams.get('store') ?? DEFAULT_FILTERS.store,
    period: searchParams.get('period') ?? DEFAULT_FILTERS.period,
    mode,
    baseline,
  }
}

export function FilterProvider({ children }: { children: ReactNode }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = useMemo(() => parseFilters(searchParams), [searchParams])

  const setFilters = useCallback(
    (patch: Partial<Filters>) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          for (const [key, value] of Object.entries(patch)) {
            if (value === undefined || value === null || value === '') {
              next.delete(key)
            } else {
              next.set(key, String(value))
            }
          }
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const resetFilters = useCallback(() => {
    setSearchParams(new URLSearchParams(), { replace: true })
  }, [setSearchParams])

  const value = useMemo<FilterContextValue>(
    () => ({ filters, setFilters, resetFilters }),
    [filters, setFilters, resetFilters],
  )

  return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>
}

export function useFilters(): FilterContextValue {
  const context = useContext(FilterContext)
  if (!context) {
    throw new Error('useFilters 必须在 FilterProvider 内使用')
  }
  return context
}
