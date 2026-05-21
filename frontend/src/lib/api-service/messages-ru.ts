/**
 * Russian error and status messages for admin orders
 */

export const ruMessages = {
  // Loading states
  loading: 'Загрузка...',
  loadingOrders: 'Загрузка заказов...',

  // Success messages
  orderStatusUpdateSuccess: 'Статус заказа успешно обновлен',
  ordersLoadedSuccessfully: 'Заказы успешно загружены',

  // Error messages - User-friendly
  errorFetchingOrders: 'Не удалось загрузить заказы',
  errorLoadingOrders: 'Ошибка при загрузке заказов. Попробуйте позже.',
  errorFetchingOrdersUnauthorized: 'Сессия истекла. Пожалуйста, выполните вход заново.',
  errorFetchingOrdersForbidden: 'У вас нет прав доступа к этому ресурсу.',
  errorFetchingOrdersNotFound: 'Заказы не найдены.',
  errorFetchingOrdersServerError: 'Сервер временно недоступен. Попробуйте позже.',
  errorFetchingOrdersNetwork: 'Ошибка сети. Проверьте подключение к интернету.',
  errorFetchingOrdersTimeout: 'Запрос выполняется слишком долго. Попробуйте позже.',
  errorFetchingOrdersRateLimit: 'Слишком много запросов. Пожалуйста, подождите.',
  errorUpdatingOrderStatus: 'Не удалось обновить статус заказа',
  errorFetchingSummary: 'Не удалось загрузить статистику',

  // Empty states
  noOrdersFound: 'Заказы не найдены',
  noOrdersText: 'Попробуйте изменить фильтры или дождитесь новых заказов.',

  // Retry
  retry: 'Повторить',
  retrying: 'Повтор...',

  // Filters
  filterByStatus: 'Фильтр по статусу',
  filterByDate: 'Фильтр по дате',
  filterByCustomer: 'Фильтр по клиенту',
  all: 'Все',

  // Status labels
  statusReceived: 'Получен',
  statusConfirmed: 'Подтвержден',
  statusShipped: 'Отправлен',
  statusCancelled: 'Отменено',
  cancelledOrders: 'Отмененные заказы',

  // Table headers
  orderNumber: 'Номер заказа',
  customer: 'Клиент',
  phone: 'Телефон',
  email: 'Email',
  status: 'Статус',
  date: 'Дата',
  actions: 'Действия',

  // Pagination
  page: 'Страница',
  of: 'из',
  items: 'Заказов',
  itemsPerPage: 'Заказов на странице',

  // Development info (for debug mode only)
  debugInfo: 'Информация отладки',
  requestUrl: 'URL запроса',
  responseStatus: 'Статус ответа',
  errorCode: 'Код ошибки',
  errorDetails: 'Детали ошибки',
}

/**
 * Get user-friendly error message for API error
 */
export function getUserFriendlyErrorMessage(code: number, detail?: string): string {
  switch (code) {
    case 401:
      return ruMessages.errorFetchingOrdersUnauthorized
    case 403:
      return ruMessages.errorFetchingOrdersForbidden
    case 404:
      return ruMessages.errorFetchingOrdersNotFound
    case 429:
      return ruMessages.errorFetchingOrdersRateLimit
    case 0:
      // Network error
      if (detail?.includes('timeout') || detail?.includes('TimeoutError')) {
        return ruMessages.errorFetchingOrdersTimeout
      }
      return ruMessages.errorFetchingOrdersNetwork
    case 500:
    case 502:
    case 503:
    case 504:
      return ruMessages.errorFetchingOrdersServerError
    default:
      return ruMessages.errorLoadingOrders
  }
}

/**
 * Format date to Russian format
 */
export function formatDateRu(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }
  return d.toLocaleDateString('ru-RU', options)
}

/**
 * Format status to Russian
 */
export function formatStatusRu(status: string): string {
  const statusMap: Record<string, string> = {
    'Received': ruMessages.statusReceived,
    'Confirmed': ruMessages.statusConfirmed,
    'Shipped': ruMessages.statusShipped,
    'Cancelled': ruMessages.statusCancelled,
  }
  return statusMap[status] || status
}
