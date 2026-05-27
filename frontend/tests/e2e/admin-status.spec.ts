import { test, expect } from '@playwright/test'

test('admin can change order status', async ({ page }) => {
  const API = process.env.E2E_API_ORIGIN || 'http://localhost:8000'
  const username = `adminflow${Date.now()}@e2e.test`
  const password = 'Passw0rd!'

  const adminCandidates = [
    { username: 'admin', password: 'admin123' },
    { username: 'admin', password: 'admin' },
    { username: 'superadmin', password: 'admin123' },
    { username: 'Superadmin', password: 'admin123' },
  ]

  // Create a customer order so admin page has status content.
  const reg = await page.request.post(`${API}/api/auth/register/`, {
    data: {
      username,
      password,
      user_type: 'INDIVIDUAL',
      fio: 'Admin Flow User',
      phone: '+998901112255',
      address: 'Tashkent',
    },
  })
  expect(reg.ok()).toBeTruthy()

  const customerLogin = await page.request.post(`${API}/api/auth/login/`, {
    data: { username, password },
  })
  expect(customerLogin.ok()).toBeTruthy()
  const customerTok = await customerLogin.json()

  const productsRes = await page.request.get(`${API}/api/products/`)
  expect(productsRes.ok()).toBeTruthy()
  const productsData = await productsRes.json()
  const availableProduct = productsData?.results?.find(
    (product: { status?: boolean; is_in_stock?: boolean }) => product.status && product.is_in_stock,
  )
  expect(availableProduct?.id).toBeTruthy()

  const addCartRes = await page.request.post(`${API}/api/cart/items/`, {
    headers: { Authorization: `Bearer ${customerTok.access}` },
    data: { product_id: availableProduct.id, quantity: 1 },
  })
  expect(addCartRes.ok()).toBeTruthy()

  const createOrderRes = await page.request.post(`${API}/api/orders/`, {
    headers: { Authorization: `Bearer ${customerTok.access}` },
  })
  expect(createOrderRes.ok()).toBeTruthy()
  const createdOrder = await createOrderRes.json()

  let tok: { access: string; refresh: string } | null = null
  for (const candidate of adminCandidates) {
    const login = await page.request.post(`${API}/api/auth/login/`, {
      data: candidate,
    })
    if (login.ok()) {
      tok = await login.json()
      break
    }
  }
  expect(tok).not.toBeNull()
  if (!tok) {
    throw new Error('No seeded admin account could be authenticated')
  }

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
  await page.goto('/admin')

  const statusRes = await page.request.post(`${API}/api/orders/${createdOrder.id}/status/`, {
    headers: { Authorization: `Bearer ${tok.access}` },
    data: { status: 'Confirmed' },
  })
  expect(statusRes.ok()).toBeTruthy()
})
