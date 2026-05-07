/**
 * Production-grade API client with comprehensive error handling,
 * retry logic, detailed logging, and type safety
 */

import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosError,
  InternalAxiosRequestConfig,
  AxiosResponse,
} from 'axios'
import { getAccessToken } from '../token-storage'
import { ApiError, isRetryableError } from './errors'
import { logger } from './logger'

interface RetryConfig {
  _retryCount?: number
  _retryStartTime?: number
}

interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

/**
 * Create axios instance with production-ready configuration
 */
function createApiClient(): AxiosInstance {
  const defaultOrigin =
    typeof window !== 'undefined' && window.location?.origin ? window.location.origin : ''
  const configuredOrigin = (import.meta.env.VITE_API_ORIGIN || '').trim().replace(/\/+$/, '')
  const apiOrigin = configuredOrigin || defaultOrigin

  const client = axios.create({
    baseURL: apiOrigin ? `${apiOrigin}/api` : '/api',
    timeout: 30000, // 30 seconds
    headers: {
      'Content-Type': 'application/json',
    },
  })

  // Request interceptor: Add auth token
  client.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      const token = getAccessToken()
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }

      logger.debug('API Request', {
        method: config.method?.toUpperCase(),
        url: config.url,
        hasToken: !!token,
      })

      return config
    },
    (error) => {
      logger.error('Request interceptor error', { error: String(error) })
      return Promise.reject(error)
    },
  )

  // Response interceptor: Enhanced retry logic and error handling
  client.interceptors.response.use(
    (response: AxiosResponse) => {
      logger.debug('API Response', {
        status: response.status,
        url: response.config.url,
      })
      return response
    },
    async (error: AxiosError) => {
      const config = error.config as RetryConfig & InternalAxiosRequestConfig

      // Determine if we should retry
      const status = error.response?.status || 0
      const shouldRetry = isRetryableError(status)
      const retryCount = config?._retryCount || 0
      const maxRetries = 3
      const retryStartTime = config?._retryStartTime || Date.now()

      // Don't retry if max retries exceeded or timeout
      if (!shouldRetry || retryCount >= maxRetries || Date.now() - retryStartTime > 30000) {
        const apiError = ApiError.fromAxiosError(error)
        logger.error('API Error (no retry)', {
          ...apiError.info,
          retryCount,
          timestamp: new Date().toISOString(),
        })
        return Promise.reject(apiError)
      }

      // Retry with exponential backoff
      const delayMs = Math.min(1000 * Math.pow(2, retryCount), 10000)

      logger.warn('Retrying API request', {
        url: config.url,
        retryCount: retryCount + 1,
        delayMs,
        status,
      })

      config._retryCount = retryCount + 1
      config._retryStartTime = retryStartTime

      await new Promise((resolve) => setTimeout(resolve, delayMs))

      return client.request(config)
    },
  )

  return client
}

export const api = createApiClient()

/**
 * Generic API request handler with error handling
 */
async function apiRequest<T>(
  method: 'get' | 'post' | 'put' | 'patch' | 'delete',
  endpoint: string,
  data?: any,
  config?: AxiosRequestConfig,
): Promise<T> {
  try {
    const response = await api[method]<T>(endpoint, data, config)
    return response.data
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }
    if (error instanceof AxiosError) {
      throw ApiError.fromAxiosError(error)
    }
    throw ApiError.unknown(error)
  }
}

/**
 * GET request with type safety
 */
export async function apiGet<T>(endpoint: string, config?: AxiosRequestConfig): Promise<T> {
  return apiRequest<T>('get', endpoint, undefined, config)
}

/**
 * POST request
 */
export async function apiPost<T>(
  endpoint: string,
  data?: any,
  config?: AxiosRequestConfig,
): Promise<T> {
  return apiRequest<T>('post', endpoint, data, config)
}

/**
 * PUT request
 */
export async function apiPut<T>(
  endpoint: string,
  data?: any,
  config?: AxiosRequestConfig,
): Promise<T> {
  return apiRequest<T>('put', endpoint, data, config)
}

/**
 * PATCH request
 */
export async function apiPatch<T>(
  endpoint: string,
  data?: any,
  config?: AxiosRequestConfig,
): Promise<T> {
  return apiRequest<T>('patch', endpoint, data, config)
}

/**
 * DELETE request
 */
export async function apiDelete<T>(endpoint: string, config?: AxiosRequestConfig): Promise<T> {
  return apiRequest<T>('delete', endpoint, undefined, config)
}

/**
 * Paginated GET request
 */
export async function apiGetPaginated<T>(
  endpoint: string,
  params?: Record<string, any>,
  config?: AxiosRequestConfig,
): Promise<PaginatedResponse<T>> {
  return apiGet<PaginatedResponse<T>>(endpoint, {
    ...config,
    params,
  })
}

export type { PaginatedResponse }
