import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth, useCart } from "@/lib/context"
import { useToast } from "@/lib/toast"
import { t } from "@/lib/i18n"
import { Product, Category, Supplier } from "@/lib/types"
import { ProductGrid, ProductFilters } from "@/components/products"
import { getProducts, getCategories, getSuppliers } from "@/lib/api"
import { Button } from "@/components/ui/button"

export function Products() {
  const { language, user } = useAuth()
  const { itemCount } = useCart()
  const { push: toast } = useToast()
  const navigate = useNavigate()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Filter state
  const [selectedCategory, setSelectedCategory] = useState<number>()
  const [selectedSupplier, setSelectedSupplier] = useState<number>()
  const [searchQuery, setSearchQuery] = useState("")

  // Redirect admins to admin panel
  useEffect(() => {
    if (user && (user.role === "ADMIN" || user.role === "SUPERADMIN")) {
      navigate("/admin")
    }
  }, [user, navigate])

  // Fetch categories and suppliers on mount
  useEffect(() => {
    const fetchFilters = async () => {
      try {
        const [categoriesData, suppliersData] = await Promise.all([
          getCategories({}),
          getSuppliers({}),
        ])

        setCategories(categoriesData.results || categoriesData)
        setSuppliers(suppliersData.results || suppliersData)
      } catch (error) {
        console.error("Failed to fetch filters:", error)
        toast({ message: t("errorFetchingFilters", language) || "Failed to load filters", type: "error" })
      }
    }

    fetchFilters()
  }, [language, toast])

  const getApiErrorMessage = (error: unknown, fallback: string) => {
    if (error && typeof error === 'object' && 'response' in error) {
      const response = (error as { response?: { data?: unknown } }).response
      const data = response?.data as Record<string, unknown> | undefined
      if (data) {
        if (typeof data.detail === 'string' && data.detail) return data.detail
        if (Array.isArray(data.unavailable_items) && data.unavailable_items.length > 0) {
          return `${data.detail || fallback}: ${(data.unavailable_items as string[]).join(', ')}`
        }
        const fieldMessages = Object.entries(data)
          .filter(([key]) => key !== 'detail')
          .flatMap(([, value]) => {
            if (Array.isArray(value)) return value.map(String)
            if (typeof value === 'string') return [value]
            return []
          })
        if (fieldMessages.length > 0) return fieldMessages.join(' ')
      }
    }
    if (error instanceof Error && error.message) return error.message
    return fallback
  }

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const params: any = {}
      if (selectedCategory) params.category = selectedCategory
      if (selectedSupplier) params.supplier = selectedSupplier
      if (searchQuery) params.search = searchQuery

      const data = await getProducts(params)
      console.log('[Products] API response:', data)
      const productsList = data.results || data
      console.log('[Products] Products list:', productsList)
      setProducts(Array.isArray(productsList) ? productsList : [])
    } catch (error) {
      const message = getApiErrorMessage(error, t("errorFetchingProducts", language) || "Failed to load products")
      console.error("Failed to fetch products:", error, message)
      setLoadError(message)
      toast({ message, type: "error" })
    } finally {
      setLoading(false)
    }
  }, [language, searchQuery, selectedCategory, selectedSupplier, toast])

  const retryFetchProducts = () => {
    fetchProducts()
  }

  // Fetch products when filters change
  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  return (
    <div className="container py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">{t("products", language)}</h1>
        <p className="text-muted-foreground">
          {t("halalChickenDesc", language)}
        </p>
      </div>

      <ProductFilters
        categories={categories}
        suppliers={suppliers}
        selectedCategory={selectedCategory}
        selectedSupplier={selectedSupplier}
        searchQuery={searchQuery}
        onCategoryChange={setSelectedCategory}
        onSupplierChange={setSelectedSupplier}
        onSearchChange={setSearchQuery}
      />

      <div className="mt-8">
        {loadError ? (
          <div className="mb-6 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
            <div className="mb-2 font-medium text-destructive">
              {t('errorFetchingProducts', language) || 'Failed to load products'}
            </div>
            <div className="flex flex-col gap-3 text-sm text-muted-foreground">
              <span>{loadError}</span>
              <div>
                <Button variant="outline" onClick={retryFetchProducts}>
                  {language === 'uz' ? 'Qayta urinish' : language === 'en' ? 'Retry' : 'Повторить'}
                </Button>
              </div>
            </div>
          </div>
        ) : null}
        <ProductGrid products={products} loading={loading} />
      </div>

      <div className="mt-8 flex items-center justify-between gap-4 rounded-xl border bg-card p-4 shadow-sm">
        <div>
          <p className="font-medium">
            {language === 'uz' ? 'Tanlangan mahsulotlar' : 'Выбранные товары'}: {itemCount.toFixed(2)} {t('kg', language)}
          </p>
          <p className="text-sm text-muted-foreground">
            {language === 'uz'
              ? 'Savatga o‘ting va buyurtmani yakunlang.'
              : 'Перейдите в корзину и завершите оформление заказа.'}
          </p>
        </div>
        <Button onClick={() => navigate('/cart')} disabled={itemCount <= 0}>
          {t('nextStep', language)}
        </Button>
      </div>
    </div>
  )
}
