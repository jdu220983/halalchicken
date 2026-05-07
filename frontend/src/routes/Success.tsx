import { useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { generateCustomerWhatsAppUrl } from '../lib/whatsapp'

export default function Success() {
  const loc = useLocation() as any
  const order = loc?.state?.order

  // Auto-open WhatsApp in a new tab when order exists (keeps UI unchanged)
  useEffect(() => {
    try {
      const business = (import.meta.env && (import.meta.env.NEXT_PUBLIC_ADMIN_WHATSAPP || import.meta.env.VITE_WHATSAPP_NUMBER || import.meta.env.NEXT_PUBLIC_WHATSAPP_NUMBER)) || '998916170642'
      if (order && order.items && order.items.length > 0) {
        const wa = generateCustomerWhatsAppUrl(order, business, 'ru', loc?.state?.total)
        if (wa) {
          window.open(wa, '_blank', 'noopener,noreferrer')
        }
      }
    } catch (err) {
      // fail silently to avoid breaking the success page
      // eslint-disable-next-line no-console
      console.error('WhatsApp auto-open failed', err)
    }
  }, [order, loc?.state])

  const business = (import.meta.env && (import.meta.env.NEXT_PUBLIC_ADMIN_WHATSAPP || import.meta.env.VITE_WHATSAPP_NUMBER || import.meta.env.NEXT_PUBLIC_WHATSAPP_NUMBER)) || '998916170642'
  const waLink = order ? generateCustomerWhatsAppUrl(order, business, 'ru', loc?.state?.total) : null

  return (
    <div>
      <h1 className="text-2xl font-semibold">Order placed</h1>
      {order && <p className="mt-2" data-testid="order-number">Order: {order.order_number}</p>}
      <p className="mt-2">Contact us via WhatsApp to finalize details.</p>
      {waLink && (
        <a className="inline-block mt-4 px-4 py-2 bg-blue-600 text-white rounded" href={waLink} target="_blank" rel="noopener noreferrer">Contact via WhatsApp</a>
      )}
    </div>
  )
}
