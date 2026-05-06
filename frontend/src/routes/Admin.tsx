import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/context'
import { useToast } from '@/lib/toast'
import { t } from '@/lib/i18n'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ShoppingCart, Package, Users as UsersIcon, MoreVertical, Download, Upload, FileSpreadsheet, Plus, Edit, Trash2, Save } from 'lucide-react'
import { PaginationControls } from '@/components/ui/pagination-controls'
import type { Order, OrderStatus, User, Product, Category, Supplier } from '@/lib/types'
import { formatDateTime } from '@/lib/utils'
import {
  adminSummary,
  listOrders,
  setOrderStatus,
  exportOrders,
  importProducts,
  getJob,
  adminTelegramContact,
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  getUsers,
  updateUserRole,
} from '@/lib/api'
import { generateAdminWhatsAppUrl } from '@/lib/whatsapp'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { ConfirmDialog } from '@/components/admin/shared/ConfirmDialog'

interface AdminStats {
  today_orders: number
  new_orders: number
  total_products: number
  total_customers: number
}

interface AsyncJob {
  id: string
  type: string
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED'
  result_url?: string
  error?: string
}

interface AdminOrder extends Omit<Order, 'user'> {
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

type AdminStatusFilter = OrderStatus | 'cancelled' | 'ALL'

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-current">
      <path d="M12.04 2C6.54 2 2.08 6.37 2.08 11.77c0 1.92.57 3.8 1.65 5.4L2 22l4.99-1.67c1.54.84 3.28 1.29 5.05 1.29h.01c5.49 0 9.95-4.37 9.95-9.77S17.53 2 12.04 2Zm5.72 14.2c-.24.67-1.43 1.27-1.97 1.34-.52.07-1.19.1-1.92-.14-.44-.14-1-.33-1.73-.64-3.04-1.31-5.02-4.37-5.18-4.58-.16-.21-1.23-1.63-1.23-3.11s.76-2.2 1.03-2.49c.24-.26.64-.38 1.03-.38.13 0 .24 0 .34.01.33.01.5.03.71.53.24.58.82 2 1 2.2.17.2.29.43.05.76-.11.15-.19.26-.35.42-.17.17-.35.36-.5.49-.17.17-.35.35-.15.69.2.34.89 1.47 1.91 2.38 1.32 1.17 2.43 1.53 2.77 1.7.34.17.54.14.74-.08.2-.22.85-.98 1.08-1.31.24-.33.46-.28.77-.17.31.11 1.96.92 2.3 1.09.34.17.56.26.65.4.09.14.09.81-.15 1.48Z" />
    </svg>
  )
}

export function Admin() {
  const { language, user, isLoading } = useAuth()
  const { push: toast } = useToast()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'orders' | 'products' | 'categories' | 'suppliers' | 'users' | 'excel'>('orders')
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [statusFilter, setStatusFilter] = useState<AdminStatusFilter>('ALL')
  const [exportJob, setExportJob] = useState<AsyncJob | null>(null)
  const [importJob, setImportJob] = useState<AsyncJob | null>(null)
  const [loading, setLoading] = useState(true)
  const [roleChangeLoading, setRoleChangeLoading] = useState<Record<string, boolean>>({})
  const [roleChangeError, setRoleChangeError] = useState<string | null>(null)
  const [roleChangeSuccess, setRoleChangeSuccess] = useState<string | null>(null)
  
  // CRUD operation loading states
  const [productSubmitLoading, setProductSubmitLoading] = useState(false)
  const [categorySubmitLoading, setCategorySubmitLoading] = useState(false)
  const [supplierSubmitLoading, setSupplierSubmitLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // Dialog states
  const [productDialogOpen, setProductDialogOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)

  // Form states
  const [productForm, setProductForm] = useState<Partial<Product>>({})
  const [productImageFile, setProductImageFile] = useState<File | null>(null)
  const [productImagePreview, setProductImagePreview] = useState<string | null>(null)
  const [categoryForm, setCategoryForm] = useState<Partial<Category>>({})
  const [supplierForm, setSupplierForm] = useState<Partial<Supplier>>({})

  // Search/filter states
  const [orderSearch, setOrderSearch] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' })
  const [productSearch, setProductSearch] = useState('')
  const [categorySearch, setCategorySearch] = useState('')
  const [supplierSearch, setSupplierSearch] = useState('')

  // Confirmation dialog states
  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean
    type: 'product' | 'category' | 'supplier' | null
    id: number | null
    name: string
  }>({ open: false, type: null, id: null, name: '' })


  // Pagination states
  const [ordersPage, setOrdersPage] = useState(1)
  const [ordersTotal, setOrdersTotal] = useState(0)
  const [productsPage, setProductsPage] = useState(1)
  const [productsTotal, setProductsTotal] = useState(0)
  const [categoriesPage, setCategoriesPage] = useState(1)
  const [categoriesTotal, setCategoriesTotal] = useState(0)
  const [suppliersPage, setSuppliersPage] = useState(1)
  const [suppliersTotal, setSuppliersTotal] = useState(0)
  const [usersPage, setUsersPage] = useState(1)
  const [usersTotal, setUsersTotal] = useState(0)
  const PAGE_SIZE = 10

  useEffect(() => {
    if (isLoading) {
      return
    }
    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN')) {
      navigate('/')
      return
    }

    fetchAdminData()
  }, [user, isLoading, navigate])

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

  const fetchProducts = useCallback(async (page = 1) => {
    try {
      const params: any = { page }
      if (productSearch) params.search = productSearch

      const data = await getProducts(params)
      setProducts(data.results || [])
      setProductsTotal(data.count || 0)
    } catch (error) {
      console.error('Failed to fetch products:', error)
      toast({ message: t('errorFetchingProducts', language) || 'Failed to fetch products', type: 'error' })
    }
  }, [productSearch, language, toast])

  const fetchCategories = useCallback(async (page = 1) => {
    try {
      const params: any = { page }
      if (categorySearch) params.search = categorySearch

      const data = await getCategories(params)
      setCategories(data.results || [])
      setCategoriesTotal(data.count || 0)
    } catch (error) {
      console.error('Failed to fetch categories:', error)
      toast({ message: t('errorFetchingCategories', language) || 'Failed to fetch categories', type: 'error' })
    }
  }, [categorySearch, language, toast])

  const fetchSuppliers = useCallback(async (page = 1) => {
    try {
      const params: any = { page }
      if (supplierSearch) params.search = supplierSearch

      const data = await getSuppliers(params)
      setSuppliers(data.results || [])
      setSuppliersTotal(data.count || 0)
    } catch (error) {
      console.error('Failed to fetch suppliers:', error)
      toast({ message: t('errorFetchingSuppliers', language) || 'Failed to fetch suppliers', type: 'error' })
    }
  }, [supplierSearch, language, toast])

  const fetchUsers = useCallback(async (page = 1) => {
    try {
      const data = await getUsers({ page })
      setUsers(data.results || [])
      setUsersTotal(data.count || 0)
    } catch (error) {
      console.error('Failed to fetch users:', error)
      toast({ message: t('errorFetchingUsers', language) || 'Failed to fetch users', type: 'error' })
    }
  }, [language, toast])

  const fetchAdminData = async () => {
    try {
      // Fetch statistics
      const statsData = await adminSummary()
      setStats(statsData)

      await Promise.all([
        fetchOrders(ordersPage),
        fetchProducts(productsPage),
        fetchCategories(categoriesPage),
        fetchSuppliers(suppliersPage),
      ])

      if (user?.role === 'SUPERADMIN') {
        await fetchUsers(usersPage)
      }

    } catch (error) {
      console.error('Failed to fetch admin data:', error)
      toast({ message: t('errorFetchingAdminData', language) || 'Failed to fetch admin data', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = async (orderId: number, newStatus: string) => {
    try {
      await setOrderStatus(orderId, newStatus)
      await fetchOrders(ordersPage)
      toast({ message: t('orderStatusUpdated', language) || 'Order status updated successfully', type: 'success' })
    } catch (error: any) {
      console.error('Failed to update status:', error)
      const errorMsg = error.response?.data?.detail || t('errorUpdatingOrderStatus', language) || 'Failed to update order status'
      toast({ message: errorMsg, type: 'error' })
    }
  }

  const handleRoleChange = async (userId: string, newRole: string) => {
    // @ts-ignore
    setRoleChangeLoading(prev => ({ ...prev, [userId]: true }))
    setRoleChangeError(null)
    setRoleChangeSuccess(null)

    try {
      const data = await updateUserRole(Number(userId), newRole)
      // @ts-ignore
      const successMsg = data.message || t('roleChangedSuccess', language) || 'Role changed successfully'
      setRoleChangeSuccess(successMsg)
      toast({ message: successMsg, type: 'success' })
      await fetchAdminData()
      setTimeout(() => setRoleChangeSuccess(null), 3000)
    } catch (error: any) {
      console.error('Failed to change role:', error)
      const errorMsg = error.response?.data?.detail || t('roleChangeFailed', language) || 'Failed to change role'
      setRoleChangeError(errorMsg)
      toast({ message: errorMsg, type: 'error' })
      setTimeout(() => setRoleChangeError(null), 5000)
    } finally {
      // @ts-ignore
      setRoleChangeLoading(prev => ({ ...prev, [userId]: false }))
    }
  }

  const handleExportOrders = async () => {
    try {
      const job = await exportOrders({})
      const jobId = job.job_id || (job as any).id
      const normalizedJob: AsyncJob = {
        id: jobId,
        type: (job as any).type || 'export_orders',
        status: job.status as 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED',
        result_url: (job as any).result_url,
        error: (job as any).error,
      }
      setExportJob(normalizedJob)
      if (jobId) {
        pollJobStatus(jobId, setExportJob)
      }
      toast({ message: t('exportStarted', language) || 'Export started', type: 'success' })
    } catch (error) {
      console.error('Failed to export orders:', error)
      toast({ message: t('errorExportingOrders', language) || 'Failed to export orders', type: 'error' })
    }
  }

  const handleImportProducts = async (file: File) => {
    try {
      const job = await importProducts(file)
      const jobId = job.job_id || (job as any).id
      const normalizedJob: AsyncJob = {
        id: jobId,
        type: (job as any).type || 'import_products',
        status: job.status as 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED',
        result_url: (job as any).result_url,
        error: (job as any).error,
      }
      setImportJob(normalizedJob)
      if (jobId) {
        pollJobStatus(jobId, setImportJob)
      }
      toast({ message: t('importStarted', language) || 'Import started', type: 'success' })
    } catch (error) {
      console.error('Failed to import products:', error)
      toast({ message: t('errorImportingProducts', language) || 'Failed to import products', type: 'error' })
    }
  }

  const pollJobStatus = async (jobId: string, setJob: (job: AsyncJob) => void) => {
    const interval = setInterval(async () => {
      try {
        const job = await getJob(jobId)
        setJob(job as AsyncJob)
        if (job.status === 'SUCCESS' || job.status === 'FAILED') {
          clearInterval(interval)
        }
      } catch (error) {
        clearInterval(interval)
      }
    }, 2000)
  }

  const statusColors: Record<OrderStatus, string> = {
    Received: 'bg-blue-100 text-blue-800 border-blue-200',
    Confirmed: 'bg-purple-100 text-purple-800 border-purple-200',
    Shipped: 'bg-green-100 text-green-800 border-green-200',
  }

  const statusTransitions: Record<OrderStatus, OrderStatus[]> = {
    Received: ['Confirmed'],
    Confirmed: ['Shipped'],
    Shipped: [],
  }
  const statusTimeline: OrderStatus[] = ['Received', 'Confirmed', 'Shipped']
  const statusFilterOptions: AdminStatusFilter[] = ['Received', 'Confirmed', 'Shipped', 'cancelled']

  const filteredOrders = orders
  const availableRoles = ['CUSTOMER', 'ADMIN', 'SUPERADMIN']
  const importColumns = ['name_uz', 'name_ru', 'category', 'supplier', 'image_url', 'description', 'status']

  // Refetch when filters change
  useEffect(() => {
    setOrdersPage(1)
    fetchOrders(1)
  }, [fetchOrders])

  useEffect(() => {
    const timer = setTimeout(() => {
      setOrdersPage(1)
      fetchOrders(1)
    }, 500)
    return () => clearTimeout(timer)
  }, [fetchOrders])

  useEffect(() => {
    const timer = setTimeout(() => {
      setProductsPage(1)
      fetchProducts(1)
    }, 500)
    return () => clearTimeout(timer)
  }, [fetchProducts])

  useEffect(() => {
    const timer = setTimeout(() => {
      setCategoriesPage(1)
      fetchCategories(1)
    }, 500)
    return () => clearTimeout(timer)
  }, [fetchCategories])

  useEffect(() => {
    const timer = setTimeout(() => {
      setSuppliersPage(1)
      fetchSuppliers(1)
    }, 500)
    return () => clearTimeout(timer)
  }, [fetchSuppliers])

  const handleDownloadTemplate = async () => {
    try {
      const blob = await downloadTemplate()
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = 'product_import_template.xlsx'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      console.error('Failed to download template:', error)
    }
  }

  const handleContactCustomer = async (order: AdminOrder) => {
    if (!order || !order.id) {
      toast({
        message: language === 'uz' ? 'Buyurtma topilmadi.' : 'Заказ не найден.',
        type: 'error',
      })
      return
    }

    if (!order.items || order.items.length === 0) {
      toast({
        message: language === 'uz' ? 'Bo‘sh buyurtma uchun WhatsApp ochib bo‘lmaydi.' : 'Нельзя открыть WhatsApp для пустого заказа.',
        type: 'error',
      })
      return
    }

    const whatsappUrl = generateAdminWhatsAppUrl(order, language === 'uz' ? 'uz' : 'ru')

    if (!whatsappUrl) {
      toast({
        message:
          language === 'uz'
            ? 'Mijozning WhatsApp raqami noto‘g‘ri yoki yo‘q.'
            : 'У клиента отсутствует или некорректный номер WhatsApp.',
        type: 'error',
      })
      return
    }

    window.open(whatsappUrl, '_blank', 'noopener,noreferrer')
  }

  // CRUD handlers for Products
  const handleCreateProduct = async () => {
    setProductSubmitLoading(true)
    try {
      const formData = new FormData()

      formData.append('category_id', String(productForm.category))
      formData.append('supplier_id', String(productForm.supplier))
      formData.append('description', productForm.description || '')
      formData.append('status', String(productForm.status ?? true))

      if (productImageFile) {
        formData.append('image_file', productImageFile)
      }

      await createProduct(formData)
      setProductDialogOpen(false)
      fetchProducts(productsPage)
      setProductForm({})
      setProductImageFile(null)
      toast({ message: t('productCreated', language) || 'Product created successfully', type: 'success' })
    } catch (error) {
      console.error('Error creating product:', error)
      toast({ message: t('errorCreatingProduct', language) || 'Failed to create product', type: 'error' })
      throw error
    } finally {
      setProductSubmitLoading(false)
    }
  }

  const handleUpdateProduct = async () => {
    if (!editingProduct) return

    setProductSubmitLoading(true)
    try {
      const formData = new FormData()

      formData.append('category_id', String(productForm.category))
      formData.append('supplier_id', String(productForm.supplier))
      formData.append('description', productForm.description || '')
      formData.append('status', String(productForm.status ?? true))

      if (productImageFile) {
        formData.append('image_file', productImageFile)
      }

      await updateProduct(editingProduct.id, formData)
      setProductDialogOpen(false)
      setEditingProduct(null)
      fetchProducts(productsPage)
      setProductForm({})
      setProductImageFile(null)
      toast({ message: t('productUpdated', language) || 'Product updated successfully', type: 'success' })
    } catch (error) {
      console.error('Error updating product:', error)
      toast({ message: t('errorUpdatingProduct', language) || 'Failed to update product', type: 'error' })
      throw error
    } finally {
      setProductSubmitLoading(false)
    }
  }

  const handleOpenProductDialog = (product?: Product) => {
    if (product) {
      setEditingProduct(product)
      setProductForm({
        category: product.category,
        supplier: product.supplier,
        description: product.description,
        status: product.status,
      })
      setProductImageFile(null)
      setProductImagePreview(null)
    } else {
      setEditingProduct(null)
      setProductForm({
        category: categories[0]?.id || 0,
        supplier: suppliers[0]?.id || 0,
        description: '',
        status: true,
      })
      setProductImageFile(null)
      setProductImagePreview(null)
    }
    setProductDialogOpen(true)
  }

  const handleSubmitProduct = async () => {
    if (!productForm.category || !productForm.supplier) {
      alert(t('pleaseFillRequired', language) || 'Please fill all required fields')
      return
    }
    try {
      if (editingProduct) {
        await handleUpdateProduct()
      } else {
        await handleCreateProduct()
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : 'An error occurred')
    }
  }

  const handleDeleteProduct = (id: number, name: string) => {
    setDeleteConfirm({
      open: true,
      type: 'product',
      id,
      name,
    })
  }

  // CRUD handlers for Categories
  const handleCreateCategory = async (data: Partial<Category>) => {
    setCategorySubmitLoading(true)
    try {
      await createCategory(data)
      await fetchCategories(categoriesPage)
      setCategoryDialogOpen(false)
      setCategoryForm({})
      toast({ message: t('categoryCreated', language) || 'Category created successfully', type: 'success' })
    } catch (error) {
      console.error('Failed to create category:', error)
      toast({ message: t('errorCreatingCategory', language) || 'Failed to create category', type: 'error' })
      throw error
    } finally {
      setCategorySubmitLoading(false)
    }
  }

  const handleUpdateCategory = async (id: number, data: Partial<Category>) => {
    setCategorySubmitLoading(true)
    try {
      await updateCategory(id, data)
      await fetchCategories(categoriesPage)
      setCategoryDialogOpen(false)
      setEditingCategory(null)
      setCategoryForm({})
      toast({ message: t('categoryUpdated', language) || 'Category updated successfully', type: 'success' })
    } catch (error) {
      console.error('Failed to update category:', error)
      toast({ message: t('errorUpdatingCategory', language) || 'Failed to update category', type: 'error' })
      throw error
    } finally {
      setCategorySubmitLoading(false)
    }
  }

  const handleOpenCategoryDialog = (category?: Category) => {
    if (category) {
      setEditingCategory(category)
      setCategoryForm({
        name_uz: category.name_uz,
        name_ru: category.name_ru,
        order: category.order,
        status: category.status,
      })
    } else {
      setEditingCategory(null)
      setCategoryForm({
        name_uz: '',
        name_ru: '',
        order: 0,
        status: true,
      })
    }
    setCategoryDialogOpen(true)
  }

  const handleSubmitCategory = async () => {
    if (!categoryForm.name_uz || !categoryForm.name_ru) {
      alert(t('pleaseFillRequired', language) || 'Please fill all required fields')
      return
    }
    try {
      if (editingCategory) {
        await handleUpdateCategory(editingCategory.id, categoryForm)
      } else {
        await handleCreateCategory(categoryForm)
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : 'An error occurred')
    }
  }

  const handleDeleteCategory = (id: number, name: string) => {
    setDeleteConfirm({
      open: true,
      type: 'category',
      id,
      name,
    })
  }

  // CRUD handlers for Suppliers
  const handleCreateSupplier = async (data: Partial<Supplier>) => {
    setSupplierSubmitLoading(true)
    try {
      await createSupplier(data)
      await fetchAdminData()
      setSupplierDialogOpen(false)
      setSupplierForm({})
      toast({ message: t('supplierCreated', language) || 'Supplier created successfully', type: 'success' })
    } catch (error) {
      console.error('Failed to create supplier:', error)
      toast({ message: t('errorCreatingSupplier', language) || 'Failed to create supplier', type: 'error' })
      throw error
    } finally {
      setSupplierSubmitLoading(false)
    }
  }

  const handleUpdateSupplier = async (id: number, data: Partial<Supplier>) => {
    setSupplierSubmitLoading(true)
    try {
      await updateSupplier(id, data)
      await fetchAdminData()
      setSupplierDialogOpen(false)
      setEditingSupplier(null)
      setSupplierForm({})
      toast({ message: t('supplierUpdated', language) || 'Supplier updated successfully', type: 'success' })
    } catch (error) {
      console.error('Failed to update supplier:', error)
      toast({ message: t('errorUpdatingSupplier', language) || 'Failed to update supplier', type: 'error' })
      throw error
    } finally {
      setSupplierSubmitLoading(false)
    }
  }

  const handleOpenSupplierDialog = (supplier?: Supplier) => {
    if (supplier) {
      setEditingSupplier(supplier)
      setSupplierForm({
        name: supplier.name,
        phone: supplier.phone || '',
        address: supplier.address || '',
        status: supplier.status,
      })
    } else {
      setEditingSupplier(null)
      setSupplierForm({
        name: '',
        phone: '',
        address: '',
        status: true,
      })
    }
    setSupplierDialogOpen(true)
  }

  const handleSubmitSupplier = async () => {
    if (!supplierForm.name) {
      alert(t('pleaseFillRequired', language) || 'Please fill all required fields')
      return
    }
    try {
      if (editingSupplier) {
        await handleUpdateSupplier(editingSupplier.id, supplierForm)
      } else {
        await handleCreateSupplier(supplierForm)
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : 'An error occurred')
    }
  }

  // Filtered lists
  // Filtered lists - now just direct data since we filter on server
  const filteredProducts = products

  const filteredCategories = categories

  const filteredSuppliers = suppliers

  const handleDeleteSupplier = (id: number, name: string) => {
    setDeleteConfirm({
      open: true,
      type: 'supplier',
      id,
      name,
    })
  }

  // Unified delete confirmation handler
  const handleConfirmDelete = async () => {
    if (!deleteConfirm.id || !deleteConfirm.type) return

    setDeleteLoading(true)
    try {
      if (deleteConfirm.type === 'product') {
        await deleteProduct(deleteConfirm.id)
        await fetchProducts(productsPage)
        toast({ message: t('productDeleted', language) || 'Product deleted successfully', type: 'success' })
      } else if (deleteConfirm.type === 'category') {
        await deleteCategory(deleteConfirm.id)
        await fetchCategories(categoriesPage)
        toast({ message: t('categoryDeleted', language) || 'Category deleted successfully', type: 'success' })
      } else if (deleteConfirm.type === 'supplier') {
        await deleteSupplier(deleteConfirm.id)
        await fetchSuppliers(suppliersPage)
        toast({ message: t('supplierDeleted', language) || 'Supplier deleted successfully', type: 'success' })
      }
      setDeleteConfirm({ open: false, type: null, id: null, name: '' })
    } catch (error: any) {
      console.error(`Failed to delete ${deleteConfirm.type}:`, error)
      const errorMsg = error.response?.data?.detail || `Failed to delete ${deleteConfirm.type}`
      toast({ message: errorMsg, type: 'error' })
      setDeleteConfirm({ open: false, type: null, id: null, name: '' })
    } finally {
      setDeleteLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="container py-8">
        <div className="text-center">{t('loading', language)}</div>
      </div>
    )
  }

  if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN')) {
    return null
  }

  if (loading) {
    return (
      <div className="container py-8">
        <div className="text-center">{t('loading', language)}</div>
      </div>
    )
  }

  return (
    <div className="container py-8">
      <h1 className="mb-8 text-3xl font-bold">{t('adminDashboard', language)}</h1>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 gap-6 mb-8 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">{t('todayOrders', language)}</CardTitle>
            <ShoppingCart className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.today_orders || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">{t('newOrders', language)}</CardTitle>
            <Package className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.new_orders || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">{t('totalProducts', language)}</CardTitle>
            <Package className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_products || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">{t('totalCustomers', language)}</CardTitle>
            <UsersIcon className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_customers || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto border-b">
        <button
          onClick={() => setActiveTab('orders')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'orders'
            ? 'border-primary text-primary'
            : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
        >
          {t('allOrders', language)}
        </button>
        <button
          onClick={() => setActiveTab('products')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'products'
            ? 'border-primary text-primary'
            : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
        >
          {t('products', language)}
        </button>
        <button
          onClick={() => setActiveTab('categories')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'categories'
            ? 'border-primary text-primary'
            : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
        >
          {t('categories', language)}
        </button>
        <button
          onClick={() => setActiveTab('suppliers')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'suppliers'
            ? 'border-primary text-primary'
            : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
        >
          {t('suppliers', language)}
        </button>
        {user.role === 'SUPERADMIN' && (
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'users'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
          >
            {t('userManagement', language)}
          </button>
        )}
        <button
          onClick={() => setActiveTab('excel')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === 'excel'
            ? 'border-primary text-primary'
            : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
        >
          Excel
        </button>
      </div>

      {/* Orders Tab */}
      {activeTab === 'orders' && (
        <Card>
          <CardHeader>
            <CardTitle>{t('allOrders', language)}</CardTitle>
            
            {/* Search and Filter Controls */}
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div>
                  <Label htmlFor="order-search" className="mb-1 text-sm">
                    {t('searchByOrderNumber', language) || 'Search by Order #'}
                  </Label>
                  <Input
                    id="order-search"
                    type="text"
                    placeholder="#20250916-001"
                    value={orderSearch}
                    onChange={(e) => setOrderSearch(e.target.value)}
                    className="w-full"
                  />
                </div>
                <div>
                  <Label htmlFor="customer-search" className="mb-1 text-sm">
                    {t('searchByCustomer', language) || 'Search by Customer'}
                  </Label>
                  <Input
                    id="customer-search"
                    type="text"
                    placeholder={t('nameOrPhone', language) || 'Name or phone'}
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    className="w-full"
                  />
                </div>
                <div>
                  <Label className="mb-1 text-sm">
                    {t('dateRange', language) || 'Date Range'}
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      type="date"
                      value={dateRange.start}
                      onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                      className="w-full"
                    />
                    <Input
                      type="date"
                      value={dateRange.end}
                      onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                      className="w-full"
                    />
                  </div>
                  {(dateRange.start || dateRange.end) && (
                    <button
                      onClick={() => setDateRange({ start: '', end: '' })}
                      className="mt-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      {t('clearDates', language)}
                    </button>
                  )}
                </div>
              </div>
              
              {/* Status Filter Buttons */}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={statusFilter === 'ALL' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter('ALL')}
                >
                  {t('allStatuses', language)}
                </Button>
                {statusFilterOptions.map((status) => (
                  <Button
                    key={status}
                    variant={statusFilter === status ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setStatusFilter(status)}
                  >
                    {t(status, language)}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredOrders.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">{t('noOrders', language)}</div>
            ) : (
              <div className="space-y-4">
                {filteredOrders.map((order) => (
                  <div key={order.id} className="p-4 border rounded-lg">
                    <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
                      <div>
                        <div className="font-medium">
                          {t('orderNumber', language)}: {order.order_number}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {formatDateTime(order.created_at)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {t('customer', language)}: {order.user?.fio || order.user?.username || `User #${order.user?.id}`}
                          {order.user?.phone && ` • ${order.user.phone}`}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          title={t('contactCustomer', language)}
                          aria-label={t('contactCustomer', language)}
                          onClick={() => handleContactCustomer(order)}
                        >
                          <span className="text-emerald-600">
                            <WhatsAppIcon />
                          </span>
                        </Button>
                        <Badge className={statusColors[order.status] || 'bg-gray-100 text-gray-800'}>
                          {t(order.status, language)}
                        </Badge>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {statusTransitions[order.status]?.length ? (
                              statusTransitions[order.status].map((status) => (
                                <DropdownMenuItem
                                  key={status}
                                  onClick={() => handleStatusChange(order.id, status)}
                                >
                                  {t(status, language)}
                                </DropdownMenuItem>
                              ))
                            ) : (
                              <DropdownMenuItem disabled>{t(order.status, language)}</DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                    <div className="space-y-3 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        {statusTimeline.map((step) => {
                          const currentIndex = statusTimeline.indexOf(order.status)
                          const stepIndex = statusTimeline.indexOf(step)
                          const reached = stepIndex <= currentIndex
                          return (
                            <div
                              key={step}
                              className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${reached ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                                }`}
                            >
                              <span className="w-2 h-2 bg-current rounded-full" />
                              {t(step, language)}
                            </div>
                          )
                        })}
                      </div>
                      <div className="mb-2 font-medium">{t('items', language)}:</div>
                      <div className="space-y-1">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="text-muted-foreground">
                            {language === 'uz' ? item.product.name_uz : item.product.name_ru} × {item.quantity}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <PaginationControls
              currentPage={ordersPage}
              totalPages={Math.ceil(ordersTotal / PAGE_SIZE)}
              onPageChange={(page) => {
                setOrdersPage(page)
                fetchOrders(page)
              }}
              hasNext={ordersPage < Math.ceil(ordersTotal / PAGE_SIZE)}
              hasPrevious={ordersPage > 1}
            />
          </CardContent>
        </Card>
      )}

      {/* Products Tab */}
      {activeTab === 'products' && (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{t('products', language)}</CardTitle>
                <Button onClick={() => handleOpenProductDialog()}>
                  <Plus className="w-4 h-4 mr-2" />
                  {t('common.addProduct', language)}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <Input
                  placeholder={t('searchProducts', language)}
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="max-w-sm"
                />
              </div>
              {loading ? (
                <div className="py-8 text-center text-muted-foreground">
                  {t('loading', language)}
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  {productSearch ? t('noProducts', language) : (language === 'uz' ? 'Siz hali mahsulot yaratmadingiz' : 'You have not created a product yet')}
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredProducts.map((product) => {
                    const categoryId = typeof product.category === 'object' ? product.category.id : product.category
                    const supplierId = typeof product.supplier === 'object' ? product.supplier.id : product.supplier
                    const categoryName = typeof product.category === 'object' ? product.category : categories.find(c => c.id === categoryId)
                    const supplierName = typeof product.supplier === 'object' ? product.supplier : suppliers.find(s => s.id === supplierId)
                    return (
                      <div key={product.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex-1">
                          <div className="font-medium">{categoryName ? (language === 'uz' ? categoryName.name_uz : categoryName.name_ru) : 'Unknown Category'}</div>
                          <div className="text-sm text-muted-foreground">
                            {t('supplier', language)}: {supplierName ? supplierName.name : `Supplier #${supplierId}`}
                          </div>
                          {product.description && (
                            <div className="mt-1 text-sm text-muted-foreground">{product.description}</div>
                          )}
                          <Badge variant={product.status ? 'default' : 'secondary'} className="mt-2">
                            {product.status ? t('inStock', language) : t('outOfStock', language)}
                          </Badge>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleOpenProductDialog(product)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteProduct(product.id, language === 'uz' ? product.name_uz : product.name_ru)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
              <PaginationControls
                currentPage={productsPage}
                totalPages={Math.ceil(productsTotal / PAGE_SIZE)}
                onPageChange={(page) => {
                  setProductsPage(page)
                  fetchProducts(page)
                }}
                hasNext={productsPage < Math.ceil(productsTotal / PAGE_SIZE)}
                hasPrevious={productsPage > 1}
              />
            </CardContent>
          </Card>

          {/* Product Dialog */}
          <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingProduct ? t('common.editProduct', language) : t('common.addProduct', language)}</DialogTitle>
                <DialogDescription>
                  {editingProduct ? t('editProductDesc', language) : t('addProductDesc', language)}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="category">{t('category', language)} *</Label>
                    <select
                      id="category"
                      className="flex w-full h-10 px-3 py-2 text-sm border rounded-md border-input bg-background ring-offset-background"
                      value={typeof productForm.category === 'object' ? productForm.category.id : (productForm.category || '')}
                      onChange={(e) => setProductForm({ ...productForm, category: Number(e.target.value) })}
                      required
                    >
                      <option value="">{t('selectCategory', language) || 'Select category'}</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {language === 'uz' ? cat.name_uz : cat.name_ru}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="supplier">{t('supplier', language)} *</Label>
                    <select
                      id="supplier"
                      className="flex w-full h-10 px-3 py-2 text-sm border rounded-md border-input bg-background ring-offset-background"
                      value={typeof productForm.supplier === 'object' ? productForm.supplier.id : (productForm.supplier || '')}
                      onChange={(e) => setProductForm({ ...productForm, supplier: Number(e.target.value) })}
                      required
                    >
                      <option value="">{t('selectSupplier', language) || 'Select supplier'}</option>
                      {suppliers.map((sup) => (
                        <option key={sup.id} value={sup.id}>
                          {sup.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="image_file">{t('imageFile', language) || 'Product Image'}</Label>
                  <Input
                    id="image_file"
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        setProductImageFile(file)
                        // Create preview URL
                        const reader = new FileReader()
                        reader.onloadend = () => {
                          setProductImagePreview(reader.result as string)
                        }
                        reader.readAsDataURL(file)
                      }
                    }}
                  />
                  {/* Image Preview */}
                  {productImagePreview && (
                    <div className="mt-2">
                      <img 
                        src={productImagePreview} 
                        alt="Preview" 
                        className="object-contain h-32 max-w-full border border-gray-200 rounded"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setProductImageFile(null)
                          setProductImagePreview(null)
                          // Clear file input
                          const fileInput = document.getElementById('image_file') as HTMLInputElement
                          if (fileInput) fileInput.value = ''
                        }}
                        className="mt-1 text-xs text-red-600 hover:text-red-800"
                      >
                        Remove image
                      </button>
                    </div>
                  )}
                  {/* Current image for editing */}
                  {editingProduct && editingProduct.image_url && !productImageFile && (
                    <div className="mt-2">
                      <div className="mb-1 text-xs text-muted-foreground">{t('currentImage', language)}:</div>
                      <img 
                        src={editingProduct.image_url} 
                        alt="Current" 
                        className="object-contain h-32 max-w-full border border-gray-200 rounded"
                      />
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">{t('description', language)}</Label>
                  <textarea
                    id="description"
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                    value={productForm.description || ''}
                    onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="status"
                    checked={productForm.status ?? true}
                    onChange={(e) => setProductForm({ ...productForm, status: e.target.checked })}
                    className="w-4 h-4 border-gray-300 rounded"
                  />
                  <Label htmlFor="status" className="cursor-pointer">{t('status', language)}: {productForm.status ? t('active', language) : t('inactive', language)}</Label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => {
                  setProductDialogOpen(false)
                  setProductImagePreview(null)
                }} disabled={productSubmitLoading}>
                  {t('cancel', language)}
                </Button>
                <Button onClick={handleSubmitProduct} disabled={productSubmitLoading}>
                  <Save className="w-4 h-4 mr-2" />
                  {productSubmitLoading ? t('loading', language) : t('save', language)}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}

      {/* Categories Tab */}
      {activeTab === 'categories' && (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{t('categories', language)}</CardTitle>
                <Button onClick={() => handleOpenCategoryDialog()}>
                  <Plus className="w-4 h-4 mr-2" />
                  {t('common.addCategory', language)}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <Input
                  placeholder={t('search', language) + '...'}
                  value={categorySearch}
                  onChange={(e) => setCategorySearch(e.target.value)}
                  className="max-w-sm"
                />
              </div>
              {filteredCategories.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  {categorySearch ? t('noResults', language) || 'No results found' : t('loading', language)}
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredCategories.map((category) => (
                    <div key={category.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <div className="font-medium">{language === 'uz' ? category.name_uz : category.name_ru}</div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          {t('order', language) || 'Order'}: {category.order}
                        </div>
                        <Badge variant={category.status ? 'default' : 'secondary'} className="mt-2">
                          {category.status ? t('active', language) : t('inactive', language)}
                        </Badge>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleOpenCategoryDialog(category)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteCategory(category.id, language === 'uz' ? category.name_uz : category.name_ru)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <PaginationControls
                currentPage={categoriesPage}
                totalPages={Math.ceil(categoriesTotal / PAGE_SIZE)}
                onPageChange={(page) => {
                  setCategoriesPage(page)
                  fetchCategories(page)
                }}
                hasNext={categoriesPage < Math.ceil(categoriesTotal / PAGE_SIZE)}
                hasPrevious={categoriesPage > 1}
              />
            </CardContent>
          </Card>

          {/* Category Dialog */}
          <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingCategory ? t('common.editCategory', language) : t('common.addCategory', language)}</DialogTitle>
                <DialogDescription>
                  {editingCategory ? t('editCategoryDesc', language) : t('addCategoryDesc', language)}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cat_name_uz">{t('nameUz', language) || 'Name (Uzbek)'} *</Label>
                    <Input
                      id="cat_name_uz"
                      value={categoryForm.name_uz || ''}
                      onChange={(e) => setCategoryForm({ ...categoryForm, name_uz: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cat_name_ru">{t('nameRu', language) || 'Name (Russian)'} *</Label>
                    <Input
                      id="cat_name_ru"
                      value={categoryForm.name_ru || ''}
                      onChange={(e) => setCategoryForm({ ...categoryForm, name_ru: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cat_order">{t('order', language) || 'Order'}</Label>
                  <Input
                    id="cat_order"
                    type="number"
                    value={categoryForm.order || 0}
                    onChange={(e) => setCategoryForm({ ...categoryForm, order: Number(e.target.value) })}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="cat_status"
                    checked={categoryForm.status ?? true}
                    onChange={(e) => setCategoryForm({ ...categoryForm, status: e.target.checked })}
                    className="w-4 h-4 border-gray-300 rounded"
                  />
                  <Label htmlFor="cat_status" className="cursor-pointer">{t('status', language)}: {categoryForm.status ? t('active', language) : t('inactive', language)}</Label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCategoryDialogOpen(false)} disabled={categorySubmitLoading}>
                  {t('cancel', language)}
                </Button>
                <Button onClick={handleSubmitCategory} disabled={categorySubmitLoading}>
                  <Save className="w-4 h-4 mr-2" />
                  {categorySubmitLoading ? t('loading', language) : t('save', language)}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}

      {/* Suppliers Tab */}
      {activeTab === 'suppliers' && (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{t('suppliers', language)}</CardTitle>
                <Button onClick={() => handleOpenSupplierDialog()}>
                  <Plus className="w-4 h-4 mr-2" />
                  {t('common.addSupplier', language)}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <Input
                  placeholder={t('search', language) + '...'}
                  value={supplierSearch}
                  onChange={(e) => setSupplierSearch(e.target.value)}
                  className="max-w-sm"
                />
              </div>
              {filteredSuppliers.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  {supplierSearch ? t('noResults', language) || 'No results found' : t('loading', language)}
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredSuppliers.map((supplier) => (
                    <div key={supplier.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <div className="font-medium">{supplier.name}</div>
                        {supplier.phone && (
                          <div className="text-sm text-muted-foreground">{t('phone', language)}: {supplier.phone}</div>
                        )}
                        {supplier.address && (
                          <div className="text-sm text-muted-foreground">{t('address_field', language)}: {supplier.address}</div>
                        )}
                        <Badge variant={supplier.status ? 'default' : 'secondary'} className="mt-2">
                          {supplier.status ? t('active', language) : t('inactive', language)}
                        </Badge>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleOpenSupplierDialog(supplier)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteSupplier(supplier.id, supplier.name)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <PaginationControls
                currentPage={suppliersPage}
                totalPages={Math.ceil(suppliersTotal / PAGE_SIZE)}
                onPageChange={(page) => {
                  setSuppliersPage(page)
                  fetchSuppliers(page)
                }}
                hasNext={suppliersPage < Math.ceil(suppliersTotal / PAGE_SIZE)}
                hasPrevious={suppliersPage > 1}
              />
            </CardContent>
          </Card>

          {/* Supplier Dialog */}
          <Dialog open={supplierDialogOpen} onOpenChange={setSupplierDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingSupplier ? t('common.editSupplier', language) : t('common.addSupplier', language)}</DialogTitle>
                <DialogDescription>
                  {editingSupplier ? t('editSupplierDesc', language) : t('addSupplierDesc', language)}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="sup_name">{t('name', language)} *</Label>
                  <Input
                    id="sup_name"
                    value={supplierForm.name || ''}
                    onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sup_phone">{t('phone', language)}</Label>
                  <Input
                    id="sup_phone"
                    type="tel"
                    value={supplierForm.phone || ''}
                    onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sup_address">{t('address_field', language)}</Label>
                  <Input
                    id="sup_address"
                    value={supplierForm.address || ''}
                    onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="sup_status"
                    checked={supplierForm.status ?? true}
                    onChange={(e) => setSupplierForm({ ...supplierForm, status: e.target.checked })}
                    className="w-4 h-4 border-gray-300 rounded"
                  />
                  <Label htmlFor="sup_status" className="cursor-pointer">{t('status', language)}: {supplierForm.status ? t('active', language) : t('inactive', language)}</Label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSupplierDialogOpen(false)} disabled={supplierSubmitLoading}>
                  {t('cancel', language)}
                </Button>
                <Button onClick={handleSubmitSupplier} disabled={supplierSubmitLoading}>
                  <Save className="w-4 h-4 mr-2" />
                  {supplierSubmitLoading ? t('loading', language) : t('save', language)}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && user.role === 'SUPERADMIN' && (
        <Card>
          <CardHeader>
            <CardTitle>{t('allUsers', language)}</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Success/Error Messages */}
            {roleChangeSuccess && (
              <div className="p-3 mb-4 text-sm text-green-800 border border-green-200 rounded-lg bg-green-50">
                {roleChangeSuccess}
              </div>
            )}
            {roleChangeError && (
              <div className="p-3 mb-4 text-sm text-red-800 border border-red-200 rounded-lg bg-red-50">
                {roleChangeError}
              </div>
            )}

            {users.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">{t('loading', language)}</div>
            ) : (
              <div className="space-y-4">
                {users.map((u) => (
                  <div key={u.id} className="p-4 border rounded-lg">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <div className="font-medium">{u.username}</div>
                        <div className="text-sm text-muted-foreground">{u.email}</div>
                        <div className="text-sm text-muted-foreground">
                          {u.fio} • {u.phone}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{t(u.role, language)}</Badge>
                        {u.id !== user.id ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={roleChangeLoading[u.id]}
                              >
                                {roleChangeLoading[u.id] ? (
                                  <span className="text-xs">{t('loading', language)}...</span>
                                ) : (
                                  <MoreVertical className="w-4 h-4" />
                                )}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {availableRoles.map((role) => (
                                <DropdownMenuItem
                                  key={role}
                                  onClick={() => handleRoleChange(u.id, role)}
                                  disabled={u.role === role || roleChangeLoading[u.id]}
                                  className={u.role === role ? 'opacity-50 cursor-not-allowed' : ''}
                                >
                                  {u.role === role ? '✓ ' : ''}{t(role, language)}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : (
                          <span className="text-xs text-muted-foreground">{t('currentUser', language)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <PaginationControls
              currentPage={usersPage}
              totalPages={Math.ceil(usersTotal / PAGE_SIZE)}
              onPageChange={(page) => {
                setUsersPage(page)
                fetchUsers(page)
              }}
              hasNext={usersPage < Math.ceil(usersTotal / PAGE_SIZE)}
              hasPrevious={usersPage > 1}
            />
          </CardContent>
        </Card>
      )}

      {/* Excel Tab */}
      {activeTab === 'excel' && (
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="w-5 h-5" />
                {t('exportOrders', language)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Button onClick={handleExportOrders} disabled={exportJob?.status === 'RUNNING'} className="w-full">
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  {exportJob?.status === 'RUNNING' ? t('exporting', language) : t('exportOrders', language)}
                </Button>

                {exportJob && (
                  <div className="p-4 space-y-2 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{t('status', language)}:</span>
                      <Badge
                        variant={
                          exportJob.status === 'SUCCESS'
                            ? 'default'
                            : exportJob.status === 'FAILED'
                              ? 'destructive'
                              : 'secondary'
                        }
                      >
                        {t(`job${exportJob.status.charAt(0) + exportJob.status.slice(1).toLowerCase()}`, language)}
                      </Badge>
                    </div>
                    {exportJob.status === 'SUCCESS' && exportJob.result_url && (
                      <a
                        href={exportJob.result_url}
                        download
                        className="flex items-center gap-2 text-sm text-primary hover:underline"
                      >
                        <Download className="w-4 h-4" />
                        {t('download', language)}
                      </a>
                    )}
                    {exportJob.status === 'FAILED' && (
                      <div className="text-sm text-destructive">{exportJob.error}</div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5" />
                {t('importProducts', language)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Button
                  variant="outline"
                  onClick={handleDownloadTemplate}
                  className="w-full"
                >
                  <Download className="w-4 h-4 mr-2" />
                  {t('downloadTemplate', language)}
                </Button>
                <Input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleImportProducts(file)
                  }}
                  disabled={importJob?.status === 'RUNNING'}
                />
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>{t('importInstructions', language)}</p>
                  <ul className="text-xs list-disc list-inside">
                    {importColumns.map((col) => (
                      <li key={col}>
                        <code>{col}</code>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs">{t('importMaxSize', language)}</p>
                </div>

                {importJob && (
                  <div className="p-4 space-y-2 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{t('status', language)}:</span>
                      <Badge
                        variant={
                          importJob.status === 'SUCCESS'
                            ? 'default'
                            : importJob.status === 'FAILED'
                              ? 'destructive'
                              : 'secondary'
                        }
                      >
                        {t(`job${importJob.status.charAt(0) + importJob.status.slice(1).toLowerCase()}`, language)}
                      </Badge>
                    </div>
                    {importJob.status === 'FAILED' && (
                      <div className="text-sm text-destructive">{importJob.error}</div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteConfirm.open}
        title={`Delete ${deleteConfirm.type === 'product' ? 'Product' : deleteConfirm.type === 'category' ? 'Category' : 'Supplier'}`}
        description={`Are you sure you want to delete "${deleteConfirm.name}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        loading={deleteLoading}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteConfirm({ open: false, type: null, id: null, name: '' })}
      />
    </div>
  )
}
