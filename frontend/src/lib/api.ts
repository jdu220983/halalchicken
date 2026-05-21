import axios, { AxiosRequestHeaders, AxiosError } from 'axios'
import { getAccessToken } from './token-storage'

const defaultOrigin =
  typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin
    : ''
const configuredOrigin = (import.meta.env.VITE_API_ORIGIN || '')
  .trim()
  .replace(/\/+$/, '')
const apiOrigin = configuredOrigin || defaultOrigin

export const api = axios.create({
  baseURL: apiOrigin ? `${apiOrigin}/api` : '/api',
})

// Request interceptor to add auth token
api.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) {
    const headers = (config.headers ??= {} as AxiosRequestHeaders)
    headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response interceptor for automatic retry on network errors
interface RetryConfig {
  _retryCount?: number
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetryConfig & typeof error.config

    // Only retry on network errors or 5xx server errors
    const shouldRetry =
      !error.response || // Network error
      (error.response.status >= 500 && error.response.status < 600) // Server error

    // Check if we haven't exceeded retry limit
    const retryCount = config?._retryCount || 0
    const maxRetries = 2

    if (shouldRetry && retryCount < maxRetries && config) {
      config._retryCount = retryCount + 1

      // Exponential backoff: 1s, 2s
      const delayMs = 1000 * Math.pow(2, retryCount)
      await new Promise((resolve) => setTimeout(resolve, delayMs))

      return api.request(config)
    }

    return Promise.reject(error)
  },
)

export type Health = { status: 'ok' }

export async function getHealth(): Promise<Health> {
  const { data } = await api.get<Health>('/healthz/')
  return data
}

export async function register(payload: Record<string, unknown>) {
  const { data } = await api.post('/auth/register/', payload)
  return data
}

export async function login(username: string, password: string) {
  const { data } = await api.post('/auth/login/', { username, password })
  return data as { access: string; refresh: string }
}

export async function me() {
  const { data } = await api.get('/auth/me/')
  return data
}

export async function updateMe(payload: Record<string, unknown>) {
  const { data } = await api.put('/auth/me/', payload)
  return data
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
) {
  const { data } = await api.post('/auth/change-password/', {
    current_password: currentPassword,
    new_password: newPassword,
  })
  return data
}

export async function deleteAccount(password: string) {
  const { data } = await api.post('/auth/delete-account/', {
    password: password,
  })
  return data
}

export async function getCart() {
  const { data } = await api.get('/cart/')
  return data as {
    id: number
    items: Array<{ id: number; product: unknown; quantity: number }>
  }
}

export async function addCartItem(product_id: number, quantity: number) {
  const { data } = await api.post('/cart/items/', { product_id, quantity })
  return data
}

export async function removeCartItem(product_id: number) {
  const { data } = await api.delete(`/cart/items/${product_id}`)
  return data
}

export interface CreateOrderPayload {
  fio?: string
  phone?: string
  address?: string
}

export async function createOrder(payload?: CreateOrderPayload) {
  const { data } = await api.post('/orders/', payload ?? {})
  return data as { id: number; order_number: string }
}

export async function getCustomerOrders(params?: { page?: number }) {
  const { data } = await api.get('/orders/', { params })
  return data
}

export async function reorderOrder(id: number) {
  const { data } = await api.post(`/orders/${id}/reorder/`)
  return data as {
    id: number
    items: Array<{ product: unknown; quantity: number }>
  }
}

export async function whatsappTemplate(orderId: number) {
  const { data } = await api.get('/whatsapp/message-template/', {
    params: { orderId },
  })
  return data as { text: string; order_number: string }
}

// Admin APIs
export async function adminSummary() {
  const { data } = await api.get('/admin/summary/')
  return data as {
    today_orders: number
    new_orders: number
    cancelled_orders?: number
    total_products: number
    total_customers: number
    status_stats?: Record<string, number>
  }
}

export async function listOrders(params?: {
  status?: string
  user?: number
  date_from?: string
  date_to?: string
}) {
  const { data } = await api.get('/admin/orders/', { params })
  return data
}

export async function setOrderStatus(id: number, status: string) {
  const { data } = await api.post(`/orders/${id}/status/`, { status })
  return data
}

export async function exportOrders(filters: {
  status?: string
  user_id?: number
  date_from?: string
  date_to?: string
}) {
  const { data } = await api.post('/admin/export/orders/', filters)
  return data as { job_id: string; status: string }
}

export async function importProducts(file: File) {
  const form = new FormData()
  form.append('file', file)
  const { data } = await api.post('/admin/import/products/', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data as { job_id: string; status: string }
}

export async function getJob(jobId: string) {
  const { data } = await api.get(`/admin/jobs/${jobId}/`)
  return data as {
    id: string
    status: string
    result_url?: string
    error?: string
  }
}

export async function adminWhatsAppContact(orderId: number) {
  const { data } = await api.get(`/admin/orders/${orderId}/whatsapp-contact/`)
  return data as {
    customer_name: string
    customer_phone: string | null
    order_number: string
    message_text: string
    wa_link: string
  }
}

export async function downloadTemplate() {
  const response = await api.get('/admin/import/products/template/', {
    responseType: 'blob',
  })
  return response.data
}

// Products
export async function getProducts(
  params?: Record<string, string | number | boolean>,
) {
  const { data } = await api.get('/products/', { params })
  return data
}

export async function createProduct(formData: FormData) {
  const { data } = await api.post('/products/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function updateProduct(id: number, formData: FormData) {
  const { data } = await api.patch(`/products/${id}/`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function deleteProduct(id: number) {
  const { data } = await api.delete(`/products/${id}/`)
  return data
}

// Categories
export async function getCategories(
  params?: Record<string, string | number | boolean>,
) {
  const { data } = await api.get('/categories/', { params })
  return data
}

export async function createCategory(
  payload: Record<string, string | number | boolean>,
) {
  const { data } = await api.post('/categories/', payload)
  return data
}

export async function updateCategory(
  id: number,
  payload: Record<string, string | number | boolean>,
) {
  const { data } = await api.patch(`/categories/${id}/`, payload)
  return data
}

export async function deleteCategory(id: number) {
  const { data } = await api.delete(`/categories/${id}/`)
  return data
}

// Suppliers
export async function getSuppliers(
  params?: Record<string, string | number | boolean>,
) {
  const { data } = await api.get('/suppliers/', { params })
  return data
}

export async function createSupplier(
  payload: Record<string, string | number | boolean>,
) {
  const { data } = await api.post('/suppliers/', payload)
  return data
}

export async function updateSupplier(
  id: number,
  payload: Record<string, string | number | boolean>,
) {
  const { data } = await api.patch(`/suppliers/${id}/`, payload)
  return data
}

export async function deleteSupplier(id: number) {
  const { data } = await api.delete(`/suppliers/${id}/`)
  return data
}

// Users (Admin)
export async function getUsers(
  params?: Record<string, string | number | boolean>,
) {
  const { data } = await api.get('/admin/users/', { params })
  return data
}

export async function updateUserRole(id: number, role: string) {
  const { data } = await api.post(`/admin/users/${id}/role/`, { role })
  return data
}
