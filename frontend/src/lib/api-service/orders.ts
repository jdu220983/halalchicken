/**
 * Orders API service layer
 * Handles all order-related API calls with proper error handling and logging
 */

import { apiGet, apiGetPaginated, apiPost, PaginatedResponse } from './client'
import { ApiError } from './errors'
import { logger } from './logger'

export interface AdminOrder {
  id: number
  order_number: string
  status: 'Received' | 'Confirmed' | 'Shipped' | 'Cancelled'
  created_at: string
  updated_at: string
  user: {
    id: number
    username: string
    fio: string | null
    phone: string | null
    email: string | null
    user_type: 'INDIVIDUAL' | 'LEGAL'
    company_name: string | null
  }
  items: Array<{
    id: number
    product: {
      id: number
      name_uz: string
      name_ru: string
    }
    quantity: number
    created_at: string
  }>
}

export interface FetchOrdersParams {
  page?: number
  page_size?: number
  status?: string | 'ALL'
  user?: number
  date_from?: string
  date_to?: string
}

/**
 * Fetch admin orders with pagination and filtering
 * @throws ApiError with detailed error information
 */
export async function fetchAdminOrders(
  params?: FetchOrdersParams,
): Promise<PaginatedResponse<AdminOrder>> {
  try {
    logger.info('Fetching admin orders', {
      page: params?.page || 1,
      status: params?.status || 'ALL',
      hasFilters: !!(params?.status || params?.user || params?.date_from || params?.date_to),
    })

    // Remove 'ALL' status from params
    const filteredParams = { ...params }
    if (filteredParams.status === 'ALL') {
      delete filteredParams.status
    }

    const response = await apiGetPaginated<AdminOrder>('/admin/orders/', filteredParams)

    logger.info('Admin orders fetched successfully', {
      count: response.count,
      returned: response.results.length,
      page: params?.page || 1,
    })

    return response
  } catch (error) {
    if (error instanceof ApiError) {
      logger.error('Failed to fetch admin orders', {
        code: error.code,
        message: error.message,
        detail: error.detail,
        url: error.info.requestUrl,
        params: params,
      })
      throw error
    }

    const apiError = ApiError.unknown(error)
    logger.error('Unknown error fetching admin orders', { error: String(error) })
    throw apiError
  }
}

/**
 * Update order status
 * @throws ApiError with detailed error information
 */
export async function updateOrderStatus(
  orderId: number,
  status: string,
): Promise<AdminOrder> {
  try {
    logger.info('Updating order status', {
      orderId,
      newStatus: status,
    })

    const response = await apiPost<AdminOrder>(`/orders/${orderId}/status/`, { status })

    logger.info('Order status updated successfully', {
      orderId,
      newStatus: status,
    })

    return response
  } catch (error) {
    if (error instanceof ApiError) {
      logger.error('Failed to update order status', {
        code: error.code,
        orderId,
        newStatus: status,
        detail: error.detail,
      })
      throw error
    }

    const apiError = ApiError.unknown(error)
    logger.error('Unknown error updating order status', { error: String(error) })
    throw apiError
  }
}

/**
 * Fetch admin summary statistics
 * @throws ApiError with detailed error information
 */
export async function fetchAdminSummary(): Promise<{
  today_orders: number
  new_orders: number
  cancelled_orders?: number
  total_products: number
  total_customers: number
  status_stats?: Record<string, number>
}> {
  try {
    logger.info('Fetching admin summary')

    const response = await apiGet<{
      today_orders: number
      new_orders: number
      cancelled_orders?: number
      total_products: number
      total_customers: number
      status_stats?: Record<string, number>
    }>('/admin/summary/')

    logger.info('Admin summary fetched successfully', response)

    return response
  } catch (error) {
    if (error instanceof ApiError) {
      logger.error('Failed to fetch admin summary', {
        code: error.code,
        message: error.message,
      })
      throw error
    }

    const apiError = ApiError.unknown(error)
    logger.error('Unknown error fetching admin summary', { error: String(error) })
    throw apiError
  }
}

export type { PaginatedResponse }
