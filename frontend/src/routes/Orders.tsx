import { useEffect, useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { useAuth, useOrders, useCart } from "@/lib/context"
import { t } from "@/lib/i18n"
import { OrderStatus } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ShoppingBag, Package, Clock, Send } from "lucide-react"
import { formatDateTime } from "@/lib/utils"
import { generateCustomerWhatsAppUrl, getAdminWhatsAppPhone } from '@/lib/whatsapp'
import { useToast } from "@/lib/toast"

const statusColors: Record<OrderStatus, string> = {
  Received: "bg-blue-500",
  Confirmed: "bg-purple-500",
  Shipped: "bg-green-500",
  Cancelled: "bg-red-500",
}

export function Orders() {
  const { language, user } = useAuth()
  const { orders, isLoading, reorder, refreshOrders } = useOrders()
  const { fetchCart } = useCart()
  const navigate = useNavigate()
  const toast = useToast()
  const [contactingId, setContactingId] = useState<number | null>(null)
  const [reorderingId, setReorderingId] = useState<number | null>(null)

  useEffect(() => {
    if (!user) {
      navigate("/login")
    } else if (user.role !== "CUSTOMER") {
      navigate("/admin")
    } else {
      refreshOrders()
    }
  }, [user, navigate, refreshOrders])

  const handleReorder = async (orderId: number) => {
    setReorderingId(orderId)
    try {
      await reorder(orderId)
      await fetchCart()
      toast.push({
        message: t("itemsAddedToCart", language) || "Items added to cart!",
        type: "success"
      })
    } catch (error) {
      console.error("Failed to reorder:", error)
      toast.push({
        message: t("reorderFailed", language) || "Failed to add items to cart",
        type: "error"
      })
    } finally {
      setReorderingId(null)
    }
  }

  const handleContact = async (orderId: number) => {
    setContactingId(orderId)
    try {
      // Find order details from local state and build WhatsApp message dynamically
      const order = orders.find((o) => o.id === orderId)
      if (!order) throw new Error('Order not found')
      const orderPayload = {
        id: order.id,
        order_number: order.order_number,
        items: order.items,
        customer: {
          name: user?.fio || user?.username || '',
          phone: user?.phone || null,
          address: user?.address || null,
        },
      }
      const wa = generateCustomerWhatsAppUrl(
        orderPayload as any,
        getAdminWhatsAppPhone(),
        language,
      )
      if (wa) window.open(wa, '_blank', 'noopener,noreferrer')
    } catch (error) {
      console.error("Failed to generate contact message:", error)
      toast.push({
        message: t("errorGeneratingMessage", language) || "Failed to generate contact message",
        type: "error"
      })
    } finally {
      setContactingId(null)
    }
  }

  if (!user) {
    return null
  }

  if (isLoading) {
    return (
      <div className="container py-8">
        <h1 className="text-3xl font-bold mb-6">{t("orderHistory", language)}</h1>
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-48 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  if (orders.length === 0) {
    return (
      <div className="container py-16">
        <div className="max-w-2xl mx-auto text-center space-y-6">
          <div className="flex justify-center">
            <div className="h-24 w-24 rounded-full bg-muted flex items-center justify-center">
              <Package className="h-12 w-12 text-muted-foreground" />
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-bold mb-2">{t("noOrders", language)}</h1>
            <p className="text-muted-foreground">{t("startShopping", language)}</p>
          </div>
          <Button onClick={() => navigate("/products")} size="lg">
            {t("browseProducts", language)}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-8">{t("orderHistory", language)}</h1>

      <div className="space-y-4">
        {orders.map((order) => (
          <Card key={order.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">
                    {t("orderNumber", language)}: {order.order_number}
                  </CardTitle>
                  <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    {formatDateTime(order.created_at)}
                  </div>
                </div>
                <Badge className={statusColors[order.status]}>
                  {t(order.status, language)}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Order Items */}
              <div className="space-y-2">
                {order.items.map((item, index) => (
                  <div key={index} className="flex items-center gap-3 text-sm">
                    <img
                      src={item.product.image_url || "https://images.unsplash.com/photo-1587593810167-a84920ea0781?w=60&h=60&fit=crop"}
                      alt={language === "uz" ? item.product.name_uz : item.product.name_ru}
                      className="h-12 w-12 object-cover rounded"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement
                        target.src = "https://images.unsplash.com/photo-1587593810167-a84920ea0781?w=60&h=60&fit=crop"
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {language === "uz" ? item.product.name_uz : item.product.name_ru}
                      </p>
                      <p className="text-muted-foreground">
                        {t("quantity", language)}: {item.quantity} {t("kg", language)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2 flex-wrap">
                <Button 
                  variant="outline" 
                  onClick={() => handleReorder(order.id)}
                  disabled={reorderingId === order.id}
                >
                  <ShoppingBag className="mr-2 h-4 w-4" />
                  {reorderingId === order.id ? t("loading", language) : t("reorder", language)}
                </Button>
                {reorderingId === order.id && (
                  <Link to="/cart">
                    <Button variant="default" size="sm">
                      {t("viewCart", language) || "View Cart"}
                    </Button>
                  </Link>
                )}
                <Button
                  variant="secondary"
                  onClick={() => handleContact(order.id)}
                  disabled={contactingId === order.id}
                >
                  <Send className="mr-2 h-4 w-4" />
                  {contactingId === order.id ? t("loading", language) : t("contactWhatsApp", language)}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
