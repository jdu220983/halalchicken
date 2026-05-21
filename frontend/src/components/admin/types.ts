import type { Order } from '@/lib/types'

export interface AdminStats {
  today_orders: number
  new_orders: number
  cancelled_orders?: number
  total_products: number
  total_customers: number
  status_stats?: Record<string, number>
}

export interface AsyncJob {
  id: string
  type: string
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED'
  result_url?: string
  error?: string
}

export interface AdminOrder extends Omit<Order, 'user'> {
  user: {
    id: number
    username: string
    fio: string | null
    phone: string | null
    email: string | null
    user_type: 'INDIVIDUAL' | 'LEGAL'
    company_name: string | null
  }
}
