import { test, expect } from '@playwright/test'

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

  // Add first product
  await expect(page.getByTestId('home-skeleton')).toBeHidden({ timeout: 10000 })
  const addBtns = page.getByTestId('add-to-cart')
  await expect(addBtns.first()).toBeVisible()
  await addBtns.first().click()

  // Go to cart and place order
  await page.goto('/cart')
  await expect(page.getByTestId('cart-empty')).toBeHidden()
  await page.getByTestId('place-order').click()
  await expect(page).toHaveURL(/checkout\/success/)
  await expect(page.getByTestId('order-number')).toBeVisible()
  await expect(page.getByRole('link', { name: /Telegram/i })).toBeVisible()
})
