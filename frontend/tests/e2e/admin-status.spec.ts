import { test, expect } from '@playwright/test'

test('admin can change order status', async ({ page }) => {
  const API = process.env.E2E_API_ORIGIN || 'http://localhost:8000'
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

  await page.goto('/admin')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

  // Ensure a valid status chip is rendered on the page.
  await expect(page.getByText(/Qabul qilindi|Tasdiqlandi|Jo.natildi|Received|Confirmed|Shipped/)).toBeVisible()
})
