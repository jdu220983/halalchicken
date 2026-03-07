import { test, expect } from '@playwright/test'

test('profile edit saves', async ({ page }) => {
  const API = process.env.E2E_API_ORIGIN || 'http://localhost:8000'
  const username = `user${Date.now()}@e2e.test`
  const password = 'Passw0rd!'
  const reg = await page.request.post(`${API}/api/auth/register/`, {
    data: {
      username,
      password,
      user_type: 'INDIVIDUAL',
      fio: 'Profile E2E',
      phone: '+998901112244',
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

  await page.goto('/profile')
  const address = page.locator('#address')
  await expect(address).toBeVisible()
  await address.fill('Somewhere 123')
  await page.getByRole('button').filter({ hasText: /Saqlash|Сохранить|Save/i }).first().click()
  await expect(address).toHaveValue('Somewhere 123')
})
