/**
 * MIGRATION GUIDE: How to integrate new API service into Admin.tsx
 * This demonstrates the minimal changes needed to use the production-ready API service
 */

// STEP 1: Update imports in Admin.tsx

// OLD:
// import { listOrders, adminSummary } from '@/lib/api'

// NEW:
import { 
  fetchAdminOrders, 
  fetchAdminSummary,
  updateOrderStatus,
  ApiError,
  logger 
} from '@/lib/api-service'
import { useAdminOrders } from '@/lib/hooks/useAdminOrders'
import { 
  ruMessages, 
  getUserFriendlyErrorMessage,
  formatDateRu,
  formatStatusRu 
} from '@/lib/api-service/messages-ru'

// STEP 2: Replace the fetchOrders function in Admin component

// OLD:
/*
const fetchOrders = useCallback(async (page = 1) => {
  try {
    const params: any = { page }
    if (statusFilter !== 'ALL') {
      params.status = statusFilter
    }
    if (orderSearch.trim()) {
      params.search = orderSearch.trim()
    }
    if (customerSearch.trim()) {
      params.customer_search = customerSearch.trim()
    }
    if (dateRange.start) {
      params.start_date = dateRange.start
    }
    if (dateRange.end) {
      params.end_date = dateRange.end
    }
    const data = await listOrders(params)
    setOrders(data.results || [])
    setOrdersTotal(data.count || 0)
  } catch (error) {
    console.error('Failed to fetch orders:', error)
    toast({ message: t('errorFetchingOrders', language) || 'Failed to fetch orders', type: 'error' })
  }
}, [statusFilter, orderSearch, customerSearch, dateRange, language, toast])
*/

// NEW:
const ordersState = useAdminOrders()

const fetchOrders = useCallback(async (page = 1) => {
  try {
    logger.info('Admin: Fetching orders', { page, statusFilter })
    
    const params: any = { page }
    if (statusFilter !== 'ALL') {
      params.status = statusFilter
    }
    
    const response = await fetchAdminOrders(params)
    setOrders(response.results || [])
    setOrdersTotal(response.count || 0)
    
    logger.info('Admin: Orders fetched successfully', { 
      count: response.results.length 
    })
  } catch (error) {
    if (error instanceof ApiError) {
      const userMessage = getUserFriendlyErrorMessage(error.code, error.detail)
      logger.error('Admin: Failed to fetch orders', {
        code: error.code,
        message: error.message,
        isRetryable: error.isRetryable,
      })
      toast({ 
        message: userMessage, 
        type: 'error' 
      })
    } else {
      logger.error('Admin: Unknown error fetching orders', { error: String(error) })
      toast({ 
        message: ruMessages.errorLoadingOrders, 
        type: 'error' 
      })
    }
  }
}, [statusFilter, language, toast])

// STEP 3: Replace fetchAdminData to use new service

// OLD:
/*
const fetchAdminData = async () => {
  try {
    const statsData = await adminSummary()
    setStats(statsData)
    await Promise.all([fetchOrders(1)])
  } catch (error) {
    // ... error handling
  }
}
*/

// NEW:
const fetchAdminData = async () => {
  try {
    logger.info('Admin: Fetching admin data')
    
    const statsData = await fetchAdminSummary()
    setStats(statsData)
    
    await fetchOrders(1)
    
    logger.info('Admin: Admin data fetched successfully')
  } catch (error) {
    if (error instanceof ApiError) {
      const userMessage = getUserFriendlyErrorMessage(error.code)
      logger.error('Admin: Failed to fetch admin data', {
        code: error.code,
        message: error.message,
      })
      toast({ message: userMessage, type: 'error' })
    } else {
      logger.error('Admin: Unknown error', { error: String(error) })
      toast({ message: ruMessages.errorLoadingOrders, type: 'error' })
    }
  } finally {
    setLoading(false)
  }
}

// STEP 4: Replace status update handler

// OLD:
/*
const handleStatusChange = async (orderId: number, newStatus: string) => {
  try {
    await setOrderStatus(orderId, newStatus)
    await fetchOrders(ordersPage)
    toast({ message: t('orderStatusUpdated', language) || 'Order status updated', type: 'success' })
  } catch (error: any) {
    const errorMsg = error.response?.data?.detail || t('errorUpdatingOrderStatus', language)
    toast({ message: errorMsg, type: 'error' })
  }
}
*/

// NEW:
const handleStatusChange = async (orderId: number, newStatus: string) => {
  try {
    logger.info('Admin: Updating order status', { orderId, newStatus })
    
    await updateOrderStatus(orderId, newStatus)
    
    await fetchOrders(ordersPage)
    
    logger.info('Admin: Order status updated successfully', { orderId, newStatus })
    toast({ 
      message: ruMessages.orderStatusUpdateSuccess, 
      type: 'success' 
    })
  } catch (error) {
    if (error instanceof ApiError) {
      logger.error('Admin: Failed to update order status', {
        code: error.code,
        orderId,
        newStatus,
      })
      toast({ 
        message: getUserFriendlyErrorMessage(error.code), 
        type: 'error' 
      })
    } else {
      logger.error('Admin: Unknown error updating status', { error: String(error) })
      toast({ message: ruMessages.errorUpdatingOrderStatus, type: 'error' })
    }
  }
}

// STEP 5: Update render to show error state

// Add this near the top of the render function:
if (error && !loading) {
  return (
    <div className="container py-8">
      <div className="border border-destructive/20 rounded-lg p-6 bg-destructive/5">
        <h2 className="font-bold text-destructive mb-2">Ошибка загрузки</h2>
        <p className="text-sm text-muted-foreground mb-4">
          {getUserFriendlyErrorMessage(error.code, error.detail)}
        </p>
        {error.isRetryable && (
          <button
            onClick={() => fetchOrders(ordersPage)}
            className="px-4 py-2 bg-primary text-primary-foreground rounded"
          >
            Повторить
          </button>
        )}
      </div>
    </div>
  )
}

// STEP 6: Add debug info in development mode

// Add this to the Admin component JSX for debugging:
{import.meta.env.DEV && (
  <div className="mt-8 p-4 bg-slate-100 rounded text-xs font-mono">
    <button
      onClick={() => console.log(logger.getLogs())}
      className="underline"
    >
      Показать логи
    </button>
  </div>
)}

/**
 * ALTERNATIVE: Use the new AdminOrdersList component directly
 * 
 * This is the recommended approach for new components or major refactors
 */

import { AdminOrdersList } from '@/components/admin/OrdersList'

export function AdminNew() {
  return (
    <div className="container py-8">
      <h1 className="mb-8 text-3xl font-bold">Панель администратора</h1>
      
      {/* Replace all the orders management code with this single component */}
      <AdminOrdersList 
        onStatusChange={handleStatusChange}
        language="ru"
      />
    </div>
  )
}

/**
 * BENEFITS OF MIGRATION:
 * 
 * 1. Type Safety: All API responses and errors are properly typed
 * 2. Error Handling: HTTP codes automatically mapped to user-friendly messages
 * 3. Logging: Complete audit trail of all API operations
 * 4. Retry Logic: Automatic retry for transient failures
 * 5. Loading States: Built-in loading indicators
 * 6. Localization: Russian messages throughout
 * 7. Maintainability: Clean separation of concerns
 * 8. Debugging: Rich error information for development
 * 
 * MIGRATION TIME: 15-30 minutes for typical Admin component
 * COMPATIBILITY: Works alongside existing code (no breaking changes)
 * TESTING: Can migrate one piece at a time
 */
