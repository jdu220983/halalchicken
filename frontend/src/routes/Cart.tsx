import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, useCart } from '@/lib/context'
import { useToast } from '@/lib/toast'
import { t } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Trash2, ShoppingBag } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { createOrder, updateMe } from '@/lib/api'
import { cleanPhone, generateCustomerWhatsAppUrl, getAdminWhatsAppPhone } from '@/lib/whatsapp'

export function Cart() {
  const { language, user, updateUser } = useAuth()
  const { cart, updateQuantity, removeFromCart, fetchCart, itemCount, isLoading } = useCart()
  const { push: toast } = useToast()
  const navigate = useNavigate()
  const [quantityInputs, setQuantityInputs] = useState<Record<number, string>>({})
  const [checkoutData, setCheckoutData] = useState({
    fio: '',
    phone: '',
    address: '',
    saveToProfile: false,
  })
  const [checkoutErrors, setCheckoutErrors] = useState<Partial<Record<'fio' | 'phone' | 'address', string>>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    // Redirect admins away from cart page
    if (user && user.role !== "CUSTOMER") {
      navigate("/admin")
      return
    }
    fetchCart()
  }, [fetchCart, user, navigate])

  useEffect(() => {
    setCheckoutData((prev) => ({
      ...prev,
      fio: user?.fio || '',
      phone: user?.phone || '',
      address: user?.address || '',
    }))
  }, [user])

  const handleCheckout = async () => {
    if (!cart || cart.items.length === 0) {
      toast({
        message: language === 'ru' ? 'Корзина пуста' : 'Savat bo‘sh',
        type: 'error',
      })
      return
    }

    if (isSubmitting) return

    const nextErrors: Partial<Record<'fio' | 'phone' | 'address', string>> = {}
    const trimmedFio = checkoutData.fio.trim()
    const trimmedPhone = checkoutData.phone.trim()
    const trimmedAddress = checkoutData.address.trim()
    const normalizedPhone = cleanPhone(trimmedPhone)

    if (!trimmedFio) nextErrors.fio = language === 'ru' ? 'Введите ФИО' : 'F.I.O ni kiriting'
    if (!trimmedPhone) {
      nextErrors.phone = language === 'ru' ? 'Введите номер телефона' : 'Telefon raqamini kiriting'
    } else if (!normalizedPhone) {
      nextErrors.phone = language === 'ru' ? 'Неверный формат телефона' : 'Telefon formati noto‘g‘ri'
    }
    if (!trimmedAddress) nextErrors.address = language === 'ru' ? 'Введите адрес' : 'Manzilni kiriting'

    setCheckoutErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      toast({
        message: t('pleaseFillRequired', language) || 'Please fill required checkout fields',
        type: 'error',
      })
      return
    }

    const totalWeight = cart.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
    const whatsappWindow = window.open('about:blank', '_blank')
    setIsSubmitting(true)

    try {
      // Create order
      const order = await createOrder({
        fio: trimmedFio,
        phone: normalizedPhone || trimmedPhone,
        address: trimmedAddress,
      })
      await fetchCart()

      if (user && checkoutData.saveToProfile) {
        const updatedUser = await updateMe({
          fio: trimmedFio,
          phone: trimmedPhone,
          address: trimmedAddress,
        })
        if (updatedUser) {
          updateUser(updatedUser)
        }
      }

      // Build WhatsApp message from the cart contents and customer details
      const orderPayload = {
        id: order.id,
        order_number: order.order_number,
        items: cart.items.map((item) => ({
          product_id: item.product.id,
          name_ru: item.product.name_ru,
          name_uz: item.product.name_uz,
          quantity: item.quantity,
          product: {
            id: item.product.id,
            name_ru: item.product.name_ru,
            name_uz: item.product.name_uz,
          },
        })),
        customer: {
          name: trimmedFio,
          phone: normalizedPhone || trimmedPhone,
          address: trimmedAddress,
        },
      }
      const waLink = generateCustomerWhatsAppUrl(
        orderPayload as any,
        getAdminWhatsAppPhone(),
        language,
        `${formatWeight(totalWeight)} ${t('kg', language)}`,
      )

      if (waLink) {
        if (whatsappWindow) {
          whatsappWindow.location.href = waLink
        } else {
          window.open(waLink, '_blank', 'noopener,noreferrer')
        }
      } else if (whatsappWindow) {
        whatsappWindow.close()
      }

      console.info('Order placed:', order.order_number)
      
      toast({ message: t('orderPlacedSuccess', language) || 'Order placed successfully!', type: 'success' })
      navigate('/orders')
    } catch (error) {
      if (whatsappWindow) {
        whatsappWindow.close()
      }
      console.error('Checkout failed:', error)
      toast({ message: t('checkoutFailed', language) || 'Failed to place order', type: 'error' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatWeight = (value: number) => Number(value || 0).toFixed(2)

  useEffect(() => {
    if (!cart) {
      setQuantityInputs({})
      return
    }

    setQuantityInputs((prev) => {
      const next: Record<number, string> = {}
      cart.items.forEach((item) => {
        const productId = item.product.id
        next[productId] = prev[productId] ?? formatWeight(item.quantity)
      })
      return next
    })
  }, [cart])

  const handleQuantityInput = (productId: number, value: string) => {
    setQuantityInputs((prev) => ({ ...prev, [productId]: value }))

    const normalized = value.replace(',', '.')
    const isNumericInput = /^\d*(\.\d*)?$/.test(normalized)

    if (!isNumericInput || normalized === '') {
      return
    }

    const parsed = Number(normalized)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return
    }

    updateQuantity(productId, parsed)
  }

  const handleQuantityBlur = (productId: number, currentQuantity: number) => {
    const currentInput = quantityInputs[productId] ?? ''
    const normalized = currentInput.replace(',', '.')

    if (normalized === '') {
      setQuantityInputs((prev) => ({ ...prev, [productId]: formatWeight(currentQuantity) }))
      return
    }

    const parsed = Number(normalized)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setQuantityInputs((prev) => ({ ...prev, [productId]: formatWeight(currentQuantity) }))
      return
    }

    setQuantityInputs((prev) => ({ ...prev, [productId]: parsed.toFixed(2) }))
  }

  if (isLoading) {
    return (
      <div className="container py-16">
        <div className="max-w-4xl mx-auto space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="container py-16">
        <div data-testid="cart-empty" className="max-w-2xl mx-auto text-center space-y-6">
          <div className="flex justify-center">
            <div className="h-24 w-24 rounded-full bg-muted flex items-center justify-center">
              <ShoppingBag className="h-12 w-12 text-muted-foreground" />
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-bold mb-2">{t('cartEmpty', language)}</h1>
            <p className="text-muted-foreground">
              {t('continueShopping', language)}
            </p>
          </div>
          <Button onClick={() => navigate('/products')} size="lg">
            {t('browseProducts', language)}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-8">{t('shoppingCart', language)}</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Cart Items */}
        <div className="lg:col-span-2 space-y-4">
          {cart.items.map((item) => (
            <Card key={item.id}>
              <CardContent className="p-6">
                <div className="flex gap-4">
                  {/* Product Image */}
                  <div className="flex-shrink-0">
                    <img
                      src={item.product.image_url || 'https://images.unsplash.com/photo-1587593810167-a84920ea0781?w=150&h=150&fit=crop'}
                      alt={language === 'uz' ? item.product.name_uz : item.product.name_ru}
                      className="h-24 w-24 object-cover rounded-lg"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement
                        target.src = 'https://images.unsplash.com/photo-1587593810167-a84920ea0781?w=150&h=150&fit=crop'
                      }}
                    />
                  </div>

                  {/* Product Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-lg mb-1 truncate">
                      {language === 'uz' ? item.product.name_uz : item.product.name_ru}
                    </h3>
                    {item.product.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {item.product.description}
                      </p>
                    )}
                  </div>

                  {/* Quantity Input */}
                  <div className="flex flex-col items-end gap-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeFromCart(item.product.id)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>

                    <div className="flex items-center gap-2 border rounded-lg px-2 py-1">
                      <Input
                        type="number"
                        min="0.1"
                        step="0.1"
                        inputMode="decimal"
                        pattern="[0-9]*[.]?[0-9]*"
                        value={quantityInputs[item.product.id] ?? formatWeight(item.quantity)}
                        onChange={(e) => handleQuantityInput(item.product.id, e.target.value)}
                        onBlur={() => handleQuantityBlur(item.product.id, item.quantity)}
                        onKeyDown={(e) => {
                          if (['e', 'E', '+', '-'].includes(e.key)) {
                            e.preventDefault()
                          }
                        }}
                        onWheel={(e) => e.currentTarget.blur()}
                        className="cart-quantity-input w-24 text-center"
                        aria-label={`${t('quantity', language)} (${t('kg', language)})`}
                      />
                      <span className="text-sm text-muted-foreground">{t('kg', language)}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-1">
          <Card className="sticky top-4">
            <CardContent className="p-6 space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-4">{t('orderSummary', language)}</h2>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('totalWeight', language)}</span>
                    <span className="font-medium">
                      {itemCount.toFixed(2)} {t('kg', language)}
                    </span>
                  </div>

                  <Separator />

                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>{t('noPricesShown', language)}</span>
                  </div>
                </div>
              </div>

              <Button
                data-testid="place-order"
                className="w-full"
                size="lg"
                onClick={handleCheckout}
                disabled={!user || isSubmitting}
              >
                {isSubmitting ? t('loading', language) : t('placeOrder', language)}
              </Button>

              <div className="space-y-3 border rounded-lg p-4">
                <div className="space-y-2">
                  <label htmlFor="checkout-fio" className="text-sm font-medium">
                    FIO
                  </label>
                  <Input
                    id="checkout-fio"
                    value={checkoutData.fio}
                    onChange={(e) => {
                      const value = e.target.value
                      setCheckoutData((prev) => ({ ...prev, fio: value }))
                      setCheckoutErrors((prev) => ({ ...prev, fio: undefined }))
                    }}
                    placeholder={language === 'ru' ? 'ФИО' : 'F.I.O'}
                    required
                  />
                  {checkoutErrors.fio && <p className="text-xs text-destructive">{checkoutErrors.fio}</p>}
                </div>

                <div className="space-y-2">
                  <label htmlFor="checkout-phone" className="text-sm font-medium">
                    {t('phone', language)}
                  </label>
                  <Input
                    id="checkout-phone"
                    type="tel"
                    value={checkoutData.phone}
                    onChange={(e) => {
                      const value = e.target.value
                      setCheckoutData((prev) => ({ ...prev, phone: value }))
                      setCheckoutErrors((prev) => ({ ...prev, phone: undefined }))
                    }}
                    placeholder="+998 90 123 45 67"
                    required
                  />
                  {checkoutErrors.phone && <p className="text-xs text-destructive">{checkoutErrors.phone}</p>}
                </div>

                <div className="space-y-2">
                  <label htmlFor="checkout-address" className="text-sm font-medium">
                    {t('address_field', language)}
                  </label>
                  <Input
                    id="checkout-address"
                    value={checkoutData.address}
                    onChange={(e) => {
                      const value = e.target.value
                      setCheckoutData((prev) => ({ ...prev, address: value }))
                      setCheckoutErrors((prev) => ({ ...prev, address: undefined }))
                    }}
                    placeholder={t('address_field', language)}
                    required
                  />
                  {checkoutErrors.address && <p className="text-xs text-destructive">{checkoutErrors.address}</p>}
                </div>

                {user && (
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={checkoutData.saveToProfile}
                      onChange={(e) =>
                        setCheckoutData((prev) => ({ ...prev, saveToProfile: e.target.checked }))
                      }
                    />
                    {language === 'ru' ? 'Сохранить в профиль' : 'Profilga saqlash'}
                  </label>
                )}
              </div>

              {!user && (
                <p className="text-xs text-center text-muted-foreground">
                  {t('pleaseLogin', language)}
                </p>
              )}

              <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground space-y-2">
                <p className="font-medium">
                  {language === 'uz'
                    ? 'Buyurtma tasdiqlangach, WhatsApp administratorga ochiladi.'
                    : 'После оформления заказа WhatsApp администратора откроется автоматически.'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {language === 'uz'
                    ? 'Xabarga buyurtma, mijoz ma’lumotlari va mahsulotlar qo‘shiladi.'
                    : 'В сообщение будут добавлены данные заказа, клиента и товары.'}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
