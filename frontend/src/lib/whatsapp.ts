export type OrderItem = {
  product_id: number
  name_ru?: string
  name_uz?: string
  quantity: number
}

export type Order = {
  id: number
  order_number: string
  created_at?: string
  status?: string
  items: OrderItem[]
  customer?: {
    name?: string | null
    phone?: string | null
    address?: string | null
  }
  user?: {
    fio?: string | null
    username?: string | null
    phone?: string | null
  }
}

export interface WhatsAppLineItem {
  product_id?: number
  quantity?: number | string
  name_ru?: string
  name_uz?: string
  product?: {
    id?: number
    name_ru?: string
    name_uz?: string
  }
}

export interface CustomerWhatsAppOrder {
  order_number?: string | null
  items?: WhatsAppLineItem[] | null
  customer?: {
    name?: string | null
    phone?: string | null
    address?: string | null
  } | null
}

export type WhatsAppLanguage = 'ru' | 'uz'

export interface WhatsAppUrlOptions {
  phone?: string | null
  message: string
}

export interface AdminWhatsAppOrder {
  id?: number | null
  order_number?: string | null
  status?: string | null
  items?: Array<unknown> | null
  user?: {
    fio?: string | null
    username?: string | null
    phone?: string | null
  } | null
}

const STATUS_LABELS: Record<WhatsAppLanguage, Record<string, string>> = {
  ru: {
    Received: 'принят',
    Confirmed: 'подтвержден',
    Shipped: 'отправлен',
  },
  uz: {
    Received: 'qabul qilindi',
    Confirmed: 'tasdiqlandi',
    Shipped: 'jo‘natildi',
  },
}

const DEFAULT_ADMIN_WHATSAPP = '998916170642'

export function getAdminWhatsAppPhone(): string | null {
  const envPhone =
    (typeof import.meta !== 'undefined' &&
      (import.meta.env.NEXT_PUBLIC_ADMIN_WHATSAPP ||
        import.meta.env.NEXT_PUBLIC_WHATSAPP_NUMBER ||
        import.meta.env.VITE_WHATSAPP_NUMBER)) ||
    DEFAULT_ADMIN_WHATSAPP

  return cleanPhone(envPhone) || DEFAULT_ADMIN_WHATSAPP
}

export function cleanPhone(phone?: string | null): string | null {
  if (!phone) return null
  const digits = phone.replace(/[^0-9]/g, '')

  if (!digits) return null

  if (digits.startsWith('998') && digits.length === 12) {
    return digits
  }

  if (digits.length === 9) {
    return `998${digits}`
  }

  if (digits.startsWith('0') && digits.length === 10) {
    return `998${digits.slice(1)}`
  }

  return null
}

export function generateWhatsAppUrl(options: WhatsAppUrlOptions): string | null {
  const phone = cleanPhone(options.phone)
  const message = options.message.trim()

  if (!phone || !message) return null

  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
}

export function generateCustomerWhatsAppMessage(
  order: CustomerWhatsAppOrder,
  language: WhatsAppLanguage = 'ru',
  totalWeight?: string,
): string | null {
  if (!order?.order_number || !order?.items || order.items.length === 0) return null

  const customerName =
    order.customer?.name?.trim() || (language === 'uz' ? 'mijoz' : 'клиент')
  const customerPhone = order.customer?.phone?.trim() || (language === 'uz' ? 'ko‘rsatilmagan' : 'не указан')
  const customerAddress = order.customer?.address?.trim() || (language === 'uz' ? 'ko‘rsatilmagan' : 'не указан')
  const weightLabel = totalWeight?.trim() || (language === 'uz' ? 'noma’lum' : 'Н/Д')

  const lines: string[] = language === 'uz'
    ? [
        'Assalomu alaykum!',
        '',
        `Yangi buyurtma #${order.order_number}`,
        '',
        `Mijoz: ${customerName}`,
        `Telefon: ${customerPhone}`,
        `Manzil: ${customerAddress}`,
        '',
        'Mahsulotlar:',
      ]
    : [
        'Здравствуйте!',
        '',
        `Новый заказ #${order.order_number}`,
        '',
        `Клиент: ${customerName}`,
        `Телефон: ${customerPhone}`,
        `Адрес: ${customerAddress}`,
        '',
        'Товары:',
      ]

  order.items.forEach((item) => {
    const name = item.name_ru || item.name_uz || item.product?.name_ru || item.product?.name_uz || `Товар #${item.product_id ?? item.product?.id ?? ''}`
    const qty = Number(item.quantity ?? 0)
    const qtyLabel = Number.isFinite(qty) && qty > 0 ? String(qty) : String(item.quantity ?? '')
    lines.push(`- ${name} ×${qtyLabel}`)
  })

  lines.push('', `${language === 'uz' ? 'Umumiy vazn' : 'Общий вес'}: ${weightLabel}`, '')
  lines.push(language === 'uz' ? 'Rahmat!' : 'Спасибо!')

  return lines.join('\n')
}

export function generateCustomerWhatsAppUrl(
  order: CustomerWhatsAppOrder,
  adminPhone?: string | null,
  language: WhatsAppLanguage = 'ru',
  totalWeight?: string,
): string | null {
  const message = generateCustomerWhatsAppMessage(order, language, totalWeight)
  const phone = cleanPhone(adminPhone || getAdminWhatsAppPhone())

  if (!message || !phone) return null

  return generateWhatsAppUrl({ phone, message })
}

export function buildAdminCustomerWhatsAppMessage(
  order: AdminWhatsAppOrder,
  language: WhatsAppLanguage = 'ru',
): string | null {
  if (!order?.order_number || !order?.status) return null

  const customerName =
    order.user?.fio?.trim() || order.user?.username?.trim() || (language === 'uz' ? 'mijoz' : 'клиент')

  const statusLabel = STATUS_LABELS[language][order.status] || order.status

  if (language === 'uz') {
    return [
      `Assalomu alaykum, ${customerName}!`,
      '',
      `Buyurtmangiz #${order.order_number} ${statusLabel}.`,
      '',
      'Buyurtmangiz uchun rahmat!',
    ].join('\n')
  }

  return [
    `Здравствуйте, ${customerName}!`,
    '',
    `Ваш заказ #${order.order_number} был ${statusLabel}.`,
    '',
    'Спасибо за заказ!',
  ].join('\n')
}

export function buildAdminCustomerWhatsAppUrl(
  order: AdminWhatsAppOrder,
  language: WhatsAppLanguage = 'ru',
): string | null {
  if (!order?.items || order.items.length === 0) return null

  const message = buildAdminCustomerWhatsAppMessage(order, language)
  const phone = order.user?.phone || null

  if (!message || !phone) return null

  return generateWhatsAppUrl({ phone, message })
}

export function generateAdminWhatsAppUrl(
  order: AdminWhatsAppOrder,
  language: WhatsAppLanguage = 'ru',
): string | null {
  return buildAdminCustomerWhatsAppUrl(order, language)
}

/**
 * Build a WhatsApp wa.me link with properly encoded Russian message.
 * - `businessNumber` is the default fallback business number (digits only)
 * - `total` is optional formatted total (string with currency)
 */
export function buildWhatsAppLink(order: Order, businessNumber?: string, total?: string) {
  if (!order || !order.items || order.items.length === 0) return null

  const customer = order.customer || {}
  const customerName = customer.name || ""
  const phone = cleanPhone(businessNumber) || getAdminWhatsAppPhone()

  const totalText = total ? `${total}` : "Н/Д"

  const lines: string[] = [
    "Здравствуйте!",
    "Я хочу подтвердить заказ.",
    "",
    `Номер заказа: ${order.order_number}`,
    "",
    "Товары:",
  ]

  order.items.forEach((it) => {
    const name = it.name_ru || it.name_uz || `Товар #${it.product_id}`
    const qty = Number.isInteger(it.quantity) ? String(it.quantity) : String(it.quantity)
    lines.push(`- ${name} ×${qty}`)
  })

  lines.push("", `Общая сумма: ${totalText}`, "", `Имя клиента: ${customerName || 'N/A'}`)
  lines.push(`Телефон: ${customer.phone || 'N/A'}`)
  lines.push(`Адрес: ${customer.address || 'N/A'}`)
  lines.push("", "Спасибо!")

  const message = lines.join('\n')
  const encoded = encodeURIComponent(message)

  if (!phone) return `https://wa.me/?text=${encoded}`
  return `https://wa.me/${phone}?text=${encoded}`
}

export default buildWhatsAppLink
