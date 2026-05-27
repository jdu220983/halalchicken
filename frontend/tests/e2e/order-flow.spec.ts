import { test, expect } from '@playwright/test'
import { generateCustomerWhatsAppUrl } from '@/lib/whatsapp'

test('register, add to cart, place order, success whatsapp CTA', async ({
  page,
}) => {
  const API = process.env.E2E_API_ORIGIN || 'http://localhost:8000'
  // Ensure backend has demo data
  await page.request.get(`${API}/api/healthz/`)

  await page.goto('/')
  // Register
  // Minimal flow: call API directly to register and set token in store
  const username = `user${Date.now()}@e2e.test`
  const password = 'Passw0rd!'
  const reg = await page.request.post(`${API}/api/auth/register/`, {
    data: {
      username,
      password,
      user_type: 'INDIVIDUAL',
      fio: 'E2E User',
      phone: '+998901112233',
      address: 'Tashkent',
    },
  })
  expect(reg.ok()).toBeTruthy()
  const loginRes = await page.request.post(`${API}/api/auth/login/`, {
    data: { username, password },
  })
  expect(loginRes.ok()).toBeTruthy()
  const tok = await loginRes.json()

  const meRes = await page.request.get(`${API}/api/auth/me/`, {
    headers: { Authorization: `Bearer ${tok.access}` },
  })
  expect(meRes.ok()).toBeTruthy()
  const me = await meRes.json()

  await page.addInitScript(({ access, refresh, user }) => {
    localStorage.setItem('access_token', access)
    localStorage.setItem('refresh_token', refresh)
    localStorage.setItem('user', JSON.stringify(user))
  }, { access: tok.access, refresh: tok.refresh, user: me })

  await page.goto('/')
  await page.waitForFunction(() => !document.querySelector('a[href="/login"]'))

  const productsRes = await page.request.get(`${API}/api/products/`)
  expect(productsRes.ok()).toBeTruthy()
  const productsData = await productsRes.json()
  const availableProduct = productsData?.results?.find(
    (product: { status?: boolean; is_in_stock?: boolean }) => product.status && product.is_in_stock,
  )
  expect(availableProduct?.id).toBeTruthy()

  const addCartRes = await page.request.post(`${API}/api/cart/items/`, {
    headers: { Authorization: `Bearer ${tok.access}` },
    data: { product_id: availableProduct.id, quantity: 1 },
  })
  expect(addCartRes.ok()).toBeTruthy()

  const orderRes = await page.request.post(`${API}/api/orders/`, {
    headers: { Authorization: `Bearer ${tok.access}` },
  })
  expect(orderRes.ok()).toBeTruthy()
  const orderData = await orderRes.json()

  const firstProduct = availableProduct
  const orderPayload = {
    id: orderData.id,
    order_number: orderData.order_number,
    items: [
      {
        product_id: firstProduct.id,
        quantity: 1,
        product: {
          id: firstProduct.id,
          name_ru: firstProduct.name_ru,
          name_uz: firstProduct.name_uz,
        },
      },
    ],
    customer: {
      name: me.fio || me.username,
      phone: me.phone,
      address: me.address,
    },
  }

  const waLink = generateCustomerWhatsAppUrl(orderPayload as any, '998916170642', 'ru')
  expect(waLink).toContain('wa.me')
  expect(decodeURIComponent(waLink)).toContain(orderData.order_number)

  await page.goto('/orders')
  await expect(page).toHaveURL(/\/orders/)
})
