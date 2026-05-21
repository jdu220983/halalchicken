export type UserRole = 'CUSTOMER' | 'ADMIN' | 'SUPERADMIN'
export type UserType = 'INDIVIDUAL' | 'LEGAL'
export type OrderStatus = 'Received' | 'Confirmed' | 'Shipped' | 'Cancelled'

export interface User {
  id: string
  username: string
  email: string
  fio: string
  phone: string
  role: UserRole
  user_type: UserType
  address: string
  // Legal entity fields
  company_name?: string
  inn?: string
  bank_details?: string
  legal_address?: string
  responsible_person?: string
  created_at: string
}

export interface Product {
  id: number
  name_uz: string
  name_ru: string
  category: number | Category
  supplier: number | Supplier
  image_url: string
  description: string
  status: boolean
  is_in_stock: boolean
  created_at: string
}

export interface Category {
  id: number
  name_uz: string
  name_ru: string
  order: number
  status: boolean
  created_at: string
}

export interface Supplier {
  id: number
  name: string
  phone?: string
  address?: string
  status: boolean
  created_at: string
}

export interface CartItem {
  id: number
  product: Product
  quantity: number
  created_at: string
}

export interface Cart {
  id: number
  items: CartItem[]
  created_at: string
}

export interface OrderItem {
  product: Product
  quantity: number
  created_at: string
}

export interface Order {
  id: number
  order_number: string
  user: number
  status: OrderStatus
  items: OrderItem[]
  created_at: string
  updated_at: string
}

export interface AdminSummary {
  today_orders: number
  new_orders: number
  cancelled_orders?: number
  total_products: number
  total_customers: number
  status_stats?: Record<string, number>
}
