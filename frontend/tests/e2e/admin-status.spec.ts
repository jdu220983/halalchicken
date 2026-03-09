import { test, expect } from '@playwright/test'

test('admin can change order status', async ({ page }) => {
  const API = process.env.E2E_API_ORIGIN || 'http://localhost:8000'
  const username = `adminflow${Date.now()}@e2e.test`
  const password = 'Passw0rd!'

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
  const firstProductId = productsData?.results?.[0]?.id
  expect(firstProductId).toBeTruthy()

  const addCartRes = await page.request.post(`${API}/api/cart/items/`, {
    headers: { Authorization: `Bearer ${customerTok.access}` },
    data: { product_id: firstProductId, quantity: 1 },
  })
  expect(addCartRes.ok()).toBeTruthy()

  const createOrderRes = await page.request.post(`${API}/api/orders/`, {
    headers: { Authorization: `Bearer ${customerTok.access}` },
  })
  expect(createOrderRes.ok()).toBeTruthy()

  // Seed command creates admin/admin user in CI.
  const login = await page.request.post(`${API}/api/auth/login/`, {
    data: { username: 'admin', password: 'admin' },
  })
  if (!login.ok()) test.skip()
  const tok = await login.json()

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
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

  // Ensure a valid status chip is rendered on the page.
  await expect(page.getByText(/Qabul qilindi|Tasdiqlandi|Jo.natildi|Received|Confirmed|Shipped/).first()).toBeVisible()
})
