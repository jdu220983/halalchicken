/**
 * Public API for API service
 * Re-exports all main types and functions
 */

export { api, apiGet, apiPost, apiPut, apiPatch, apiDelete, apiGetPaginated } from './client'
export type { PaginatedResponse } from './client'

export { ApiError } from './errors'
export type { ErrorInfo } from './errors'

export { logger } from './logger'
export type { LogLevel } from './logger'

export {
  fetchAdminOrders,
  updateOrderStatus,
  fetchAdminSummary,
} from './orders'
export type { AdminOrder, FetchOrdersParams } from './orders'
