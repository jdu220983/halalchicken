/**
 * Production-ready error handling for API operations
 * Supports detailed logging and user-friendly messages
 */

import { AxiosError } from 'axios'

export type HttpErrorCode = 400 | 401 | 403 | 404 | 429 | 500 | 502 | 503 | 504

export interface ApiErrorResponse {
  detail?: string
  message?: string
  error?: string
  [key: string]: any
}

export interface ErrorInfo {
  code: number
  message: string
  userMessage: string
  detail: string
  timestamp: string
  requestUrl?: string
  requestMethod?: string
  responseStatus?: number
  responseData?: any
  isRetryable: boolean
  isDeveloperError: boolean
}

export class ApiError extends Error {
  public readonly code: number
  public readonly detail: string
  public readonly userMessage: string
  public readonly isRetryable: boolean
  public readonly isDeveloperError: boolean
  public readonly info: ErrorInfo

  constructor(
    code: number,
    message: string,
    userMessage: string,
    detail: string,
    isRetryable: boolean = false,
    isDeveloperError: boolean = false,
    requestUrl?: string,
    requestMethod?: string,
    responseData?: any,
  ) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.detail = detail
    this.userMessage = userMessage
    this.isRetryable = isRetryable
    this.isDeveloperError = isDeveloperError

    this.info = {
      code,
      message,
      userMessage,
      detail,
      timestamp: new Date().toISOString(),
      requestUrl,
      requestMethod,
      responseStatus: code,
      responseData,
      isRetryable,
      isDeveloperError,
    }
  }

  static fromAxiosError(error: AxiosError<ApiErrorResponse>): ApiError {
    const status = error.response?.status || 0
    const data = error.response?.data
    const config = error.config

    // Network error (no response)
    if (!error.response) {
      return new ApiError(
        0,
        `Network Error: ${error.message}`,
        'Ошибка сети. Проверьте подключение к интернету.',
        `Failed to connect to API. Network unreachable.`,
        true,
        false,
        config?.url,
        config?.method,
      )
    }

    // 401 Unauthorized
    if (status === 401) {
      return new ApiError(
        401,
        'Unauthorized',
        'Сессия истекла. Пожалуйста, выполните вход заново.',
        data?.detail || 'Authentication required',
        false,
        false,
        config?.url,
        config?.method,
        data,
      )
    }

    // 403 Forbidden
    if (status === 403) {
      return new ApiError(
        403,
        'Forbidden',
        'У вас нет прав доступа к этому ресурсу.',
        data?.detail || 'Access denied',
        false,
        false,
        config?.url,
        config?.method,
        data,
      )
    }

    // 404 Not Found
    if (status === 404) {
      return new ApiError(
        404,
        'Not Found',
        'Запрошенный ресурс не найден.',
        data?.detail || 'Resource not found',
        false,
        false,
        config?.url,
        config?.method,
        data,
      )
    }

    // 429 Too Many Requests
    if (status === 429) {
      return new ApiError(
        429,
        'Too Many Requests',
        'Слишком много запросов. Пожалуйста, подождите.',
        'Rate limit exceeded',
        true,
        false,
        config?.url,
        config?.method,
        data,
      )
    }

    // 500+ Server Errors
    if (status >= 500) {
      return new ApiError(
        status,
        `Server Error ${status}`,
        'Сервер временно недоступен. Попробуйте позже.',
        data?.detail || `Server error: ${status}`,
        true,
        true,
        config?.url,
        config?.method,
        data,
      )
    }

    // 400 Bad Request
    if (status === 400) {
      return new ApiError(
        400,
        'Bad Request',
        data?.detail || 'Ошибка при обработке запроса.',
        data?.detail || 'Invalid request',
        false,
        false,
        config?.url,
        config?.method,
        data,
      )
    }

    // Other errors
    return new ApiError(
      status,
      `HTTP ${status}`,
      'Неизвестная ошибка. Попробуйте позже.',
      data?.detail || error.message,
      false,
      false,
      config?.url,
      config?.method,
      data,
    )
  }

  static timeout(): ApiError {
    return new ApiError(
      0,
      'Request Timeout',
      'Запрос выполняется слишком долго. Проверьте соединение.',
      'The request took too long to complete',
      true,
      false,
    )
  }

  static unknown(error: unknown): ApiError {
    const message = error instanceof Error ? error.message : String(error)
    return new ApiError(
      0,
      'Unknown Error',
      'Произошла неожиданная ошибка.',
      message,
      false,
      false,
    )
  }
}

/**
 * Determine if an error is retryable based on HTTP status code
 */
export function isRetryableError(status: number): boolean {
  return status === 0 || status === 408 || status === 429 || (status >= 500 && status < 600)
}

/**
 * Format error for logging
 */
export function formatErrorForLog(error: ApiError): string {
  return `[${error.code}] ${error.message} - ${error.detail}`
}
