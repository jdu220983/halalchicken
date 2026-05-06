/**
 * QUICK REFERENCE GUIDE
 * Copy-paste patterns for common scenarios
 */

// ============================================================================
// 1. FETCH ORDERS WITH ERROR HANDLING
// ============================================================================

import { fetchAdminOrders, ApiError } from '@/lib/api-service'
import { logger, getUserFriendlyErrorMessage } from '@/lib/api-service'

async function loadOrders() {
  try {
    logger.info('Fetching admin orders')
    const response = await fetchAdminOrders({ page: 1, status: 'ALL' })
    logger.info('Orders fetched', { count: response.results.length })
    return response.results
  } catch (error) {
    if (error instanceof ApiError) {
      logger.error('Failed to fetch orders', {
        code: error.code,
        message: error.detail,
        isRetryable: error.isRetryable,
      })
      throw new Error(getUserFriendlyErrorMessage(error.code))
    }
    logger.error('Unknown error', { error: String(error) })
    throw error
  }
}

// ============================================================================
// 2. USE THE CUSTOM HOOK
// ============================================================================

import { useAdminOrders } from '@/lib/hooks/useAdminOrders'

function AdminOrders() {
  const { orders, loading, error, totalCount, retry, setPage } = useAdminOrders()

  if (loading) return <div>Loading...</div>

  if (error) {
    return (
      <div>
        <p>Error: {error.userMessage}</p>
        {error.isRetryable && <button onClick={retry}>Retry</button>}
      </div>
    )
  }

  return (
    <div>
      <ul>
        {orders.map((order) => (
          <li key={order.id}>{order.order_number}</li>
        ))}
      </ul>
      <p>
        Total: {totalCount} | Page size: {orders.length}
      </p>
      <button onClick={() => setPage(1)}>Previous</button>
      <button onClick={() => setPage(2)}>Next</button>
    </div>
  )
}

// ============================================================================
// 3. UPDATE ORDER STATUS WITH RETRY BUTTON
// ============================================================================

import { updateOrderStatus } from '@/lib/api-service'
import { logger } from '@/lib/api-service'

async function handleStatusChange(orderId: number, newStatus: string) {
  try {
    logger.info('Updating order status', { orderId, newStatus })
    await updateOrderStatus(orderId, newStatus)
    logger.info('Status updated', { orderId, newStatus })
    toast({ message: 'Статус обновлен', type: 'success' })
    // Refresh orders
    await fetchOrders()
  } catch (error) {
    if (error instanceof ApiError) {
      logger.error('Failed to update status', {
        code: error.code,
        orderId,
        isRetryable: error.isRetryable,
      })
      toast({
        message: getUserFriendlyErrorMessage(error.code),
        action: error.isRetryable ? {
          label: 'Retry',
          onClick: () => handleStatusChange(orderId, newStatus),
        } : undefined,
      })
    }
  }
}

// ============================================================================
// 4. GET RUSSIAN ERROR MESSAGE
// ============================================================================

import { getUserFriendlyErrorMessage } from '@/lib/api-service'

// Usage
const message401 = getUserFriendlyErrorMessage(401) // "Сессия истекла"
const message403 = getUserFriendlyErrorMessage(403) // "Нет прав доступа"
const message500 = getUserFriendlyErrorMessage(500) // "Сервер недоступен"

// Display to user
showToast(message401)

// ============================================================================
// 5. FORMAT DATES AND STATUSES IN RUSSIAN
// ============================================================================

import { formatDateRu, formatStatusRu } from '@/lib/api-service'

const dateStr = formatDateRu(order.created_at)
// Input: "2024-01-15T10:23:45Z"
// Output: "15.01.2024, 10:23"

const statusStr = formatStatusRu(order.status)
// Input: "Received"
// Output: "Получен"

// Display in UI
<p>Дата: {formatDateRu(order.created_at)}</p>
<p>Статус: {formatStatusRu(order.status)}</p>

// ============================================================================
// 6. ACCESS LOGS FOR DEBUGGING
// ============================================================================

import { logger } from '@/lib/api-service'

// View all logs in console
const allLogs = logger.getLogs()
console.table(allLogs)

// Export logs for error reporting
const logsJson = logger.exportLogs()
console.log(logsJson)
// Or send to backend:
// POST /api/logs { logs: logsJson }

// Clear logs
logger.clearLogs()

// ============================================================================
// 7. ERROR HANDLING IN COMPONENTS
// ============================================================================

import { ApiError } from '@/lib/api-service'

// Catch and handle errors
function AdminComponent() {
  const [error, setError] = useState<ApiError | null>(null)

  const handleFetch = async () => {
    try {
      const orders = await fetchAdminOrders()
      setError(null)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err)
      }
    }
  }

  if (error) {
    return (
      <div>
        <h2>Error occurred</h2>
        <p>User message: {error.userMessage}</p>
        {error.isDeveloperError && (
          <details>
            <summary>Debug Info</summary>
            <pre>{JSON.stringify(error.info, null, 2)}</pre>
          </details>
        )}
        {error.isRetryable && (
          <button onClick={handleFetch}>Retry</button>
        )}
      </div>
    )
  }
}

// ============================================================================
// 8. PAGINATION HANDLING
// ============================================================================

import { useAdminOrders } from '@/lib/hooks/useAdminOrders'

function Orders() {
  const {
    orders,
    totalCount,
    page,
    pageSize,
    setPage,
    setPageSize,
  } = useAdminOrders()

  const totalPages = Math.ceil(totalCount / pageSize)

  return (
    <div>
      <OrdersTable orders={orders} />

      <div className="pagination">
        <label>
          Items per page:
          <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </label>

        <div>
          Showing {orders.length} of {totalCount} items
        </div>

        <button onClick={() => setPage(page - 1)} disabled={page === 1}>
          Previous
        </button>

        <span>
          Page {page} of {totalPages}
        </span>

        <button onClick={() => setPage(page + 1)} disabled={page >= totalPages}>
          Next
        </button>
      </div>
    </div>
  )
}

// ============================================================================
// 9. FILTER AND SEARCH
// ============================================================================

import { useAdminOrders } from '@/lib/hooks/useAdminOrders'

function OrdersWithFilters() {
  const { orders, fetchOrders } = useAdminOrders()
  const [status, setStatus] = useState('ALL')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const handleFilter = async () => {
    await fetchOrders(1, {
      status: status === 'ALL' ? undefined : status,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
    })
  }

  return (
    <div>
      <select value={status} onChange={(e) => setStatus(e.target.value)}>
        <option value="ALL">All statuses</option>
        <option value="Received">Received</option>
        <option value="Confirmed">Confirmed</option>
        <option value="Shipped">Shipped</option>
      </select>

      <input
        type="date"
        value={dateFrom}
        onChange={(e) => setDateFrom(e.target.value)}
      />

      <input
        type="date"
        value={dateTo}
        onChange={(e) => setDateTo(e.target.value)}
      />

      <button onClick={handleFilter}>Apply Filters</button>

      <OrdersList orders={orders} />
    </div>
  )
}

// ============================================================================
// 10. COMPLETE COMPONENT EXAMPLE
// ============================================================================

import React, { useState } from 'react'
import { useAdminOrders } from '@/lib/hooks/useAdminOrders'
import {
  ApiError,
  updateOrderStatus,
  getUserFriendlyErrorMessage,
  formatDateRu,
  formatStatusRu,
  logger,
} from '@/lib/api-service'

export function AdminOrders() {
  const { orders, loading, error, retry, totalCount, page, setPage, fetchOrders } = useAdminOrders()
  const [updating, setUpdating] = useState<Record<number, boolean>>({})

  const handleStatusChange = async (orderId: number, newStatus: string) => {
    setUpdating((prev) => ({ ...prev, [orderId]: true }))
    try {
      logger.info('Updating status', { orderId, newStatus })
      await updateOrderStatus(orderId, newStatus)
      await fetchOrders(page)
      logger.info('Status updated successfully')
    } catch (error) {
      if (error instanceof ApiError) {
        logger.error('Failed to update', { code: error.code })
        alert(getUserFriendlyErrorMessage(error.code))
      }
    } finally {
      setUpdating((prev) => ({ ...prev, [orderId]: false }))
    }
  }

  if (loading) {
    return <div>Загрузка заказов...</div>
  }

  if (error) {
    return (
      <div style={{ color: 'red' }}>
        <p>Ошибка: {error.userMessage}</p>
        {error.isRetryable && (
          <button onClick={retry}>Повторить</button>
        )}
      </div>
    )
  }

  return (
    <div>
      <h1>Заказы ({totalCount})</h1>

      <table border={1}>
        <thead>
          <tr>
            <th>Номер</th>
            <th>Клиент</th>
            <th>Статус</th>
            <th>Дата</th>
            <th>Действие</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id}>
              <td>{order.order_number}</td>
              <td>{order.user.fio}</td>
              <td>{formatStatusRu(order.status)}</td>
              <td>{formatDateRu(order.created_at)}</td>
              <td>
                <select
                  disabled={updating[order.id] || loading}
                  onChange={(e) => handleStatusChange(order.id, e.target.value)}
                >
                  <option>-- Изменить статус --</option>
                  {order.status === 'Received' && (
                    <option value="Confirmed">{formatStatusRu('Confirmed')}</option>
                  )}
                  {order.status === 'Confirmed' && (
                    <option value="Shipped">{formatStatusRu('Shipped')}</option>
                  )}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: '20px' }}>
        <button onClick={() => setPage(page - 1)} disabled={page === 1}>
          Назад
        </button>
        <span> Страница {page} </span>
        <button onClick={() => setPage(page + 1)} disabled={orders.length === 0}>
          Далее
        </button>
      </div>
    </div>
  )
}

// ============================================================================
// COMMON ERROR CODES
// ============================================================================

/*
HTTP CODE | MEANING | USER MESSAGE | RETRY?
---------|---------|------------|-------
200 | OK | Success | No
400 | Bad Request | Invalid data | No
401 | Unauthorized | Session expired | No
403 | Forbidden | No permission | No
404 | Not Found | Resource not found | No
429 | Rate Limited | Too many requests | YES
500 | Server Error | Server unavailable | YES
502 | Bad Gateway | Server unavailable | YES
503 | Service Unavailable | Server unavailable | YES
504 | Gateway Timeout | Request timeout | YES
0 | Network Error | Network error | YES
*/

// ============================================================================
// LOGGING PATTERNS
// ============================================================================

// Good logging
logger.info('Admin orders loaded', { count: 15, page: 1 })
logger.error('Failed to fetch', { code: 403, userId: 42 })

// Bad logging (avoid)
logger.error('error')  // Too vague
logger.error(error)  // Don't log object directly, extract properties
logger.info(JSON.stringify(bigObject))  // Too much data

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

import type {
  AdminOrder,
  FetchOrdersParams,
  PaginatedResponse,
  ApiError,
  HttpErrorCode,
} from '@/lib/api-service'

// Usage
const params: FetchOrdersParams = {
  page: 1,
  status: 'Received',
  date_from: '2024-01-01',
}

const response: PaginatedResponse<AdminOrder> = await fetchAdminOrders(params)

// ============================================================================
// TESTING PATTERNS
// ============================================================================

// Mock API for tests
jest.mock('@/lib/api-service', () => ({
  fetchAdminOrders: jest.fn().mockResolvedValue({
    count: 10,
    results: [{ id: 1, order_number: '#001' }],
  }),
}))

// Test error handling
test('shows error message on 401', async () => {
  jest.spyOn(api, 'fetchAdminOrders').mockRejectedValue(
    ApiError.create({
      code: 401,
      detail: 'Token expired',
      userMessage: 'Сессия истекла',
    })
  )

  render(<AdminOrders />)
  await waitFor(() => {
    expect(screen.getByText('Сессия истекла')).toBeInTheDocument()
  })
})
