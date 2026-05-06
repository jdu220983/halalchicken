/**
 * Custom hook for fetching admin orders with retry logic and loading states
 */

import { useState, useCallback, useEffect } from 'react'
import {
  fetchAdminOrders,
  AdminOrder,
  FetchOrdersParams,
  ApiError,
  logger,
} from '@/lib/api-service'

export interface UseAdminOrdersReturn {
  orders: AdminOrder[]
  loading: boolean
  error: ApiError | null
  totalCount: number
  page: number
  pageSize: number
  
  // Actions
  fetchOrders: (page?: number, params?: FetchOrdersParams) => Promise<void>
  retry: () => Promise<void>
  setPage: (page: number) => void
  setPageSize: (size: number) => void
  clearError: () => void
}

/**
 * Hook to fetch and manage admin orders
 */
export function useAdminOrders(initialParams?: FetchOrdersParams): UseAdminOrdersReturn {
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPageState] = useState(initialParams?.page || 1)
  const [pageSize, setPageSizeState] = useState(initialParams?.page_size || 20)

  const fetchOrders = useCallback(
    async (pageNum?: number, params?: FetchOrdersParams) => {
      const currentPage = pageNum || page
      setLoading(true)
      setError(null)

      try {
        logger.info('useAdminOrders: Fetching orders', {
          page: currentPage,
          pageSize,
          ...params,
        })

        const response = await fetchAdminOrders({
          page: currentPage,
          page_size: pageSize,
          ...params,
        })

        setOrders(response.results)
        setTotalCount(response.count)
        setPageState(currentPage)

        logger.info('useAdminOrders: Orders fetched successfully', {
          count: response.results.length,
          total: response.count,
        })
      } catch (err) {
        const apiError = err instanceof ApiError ? err : ApiError.unknown(err)
        setError(apiError)
        setOrders([])
        setTotalCount(0)

        logger.error('useAdminOrders: Failed to fetch orders', {
          code: apiError.code,
          message: apiError.message,
          isRetryable: apiError.isRetryable,
        })
      } finally {
        setLoading(false)
      }
    },
    [page, pageSize],
  )

  const retry = useCallback(async () => {
    logger.info('useAdminOrders: Retrying fetch')
    await fetchOrders(page, initialParams)
  }, [page, initialParams, fetchOrders])

  const setPage = useCallback((newPage: number) => {
    setPageState(newPage)
  }, [])

  const setPageSize = useCallback((newSize: number) => {
    setPageSizeState(newSize)
    setPageState(1) // Reset to first page when page size changes
  }, [])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  // Fetch orders when page or pageSize changes
  useEffect(() => {
    fetchOrders(page, initialParams)
  }, [page, pageSize, initialParams, fetchOrders])

  return {
    orders,
    loading,
    error,
    totalCount,
    page,
    pageSize,
    fetchOrders,
    retry,
    setPage,
    setPageSize,
    clearError,
  }
}
