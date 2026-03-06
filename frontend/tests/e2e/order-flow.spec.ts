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
    data: { username, password },
  })
  expect(reg.ok()).toBeTruthy()
  const tok = await (
    await page.request.post(`${API}/api/auth/login/`, {
      data: { username, password },
    })
  ).json()
  // Inject token into app store
  await page.addInitScript(() => {
    // @ts-ignore
    window.__setToken = (val) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(window as any).useAuth?.getState?.().setToken(val)
      localStorage.setItem('access', val)
    }
  })
  await page.reload()
  await page.evaluate((t) => {
    // @ts-ignore
    window.__setToken?.(t)
  }, tok.access)

  // Add first product
  await expect(page.getByTestId('home-skeleton')).toBeHidden({ timeout: 10000 })
  const addBtns = page.getByTestId('add-to-cart')
  await expect(addBtns.first()).toBeVisible()
  await addBtns.first().click()

  // Go to cart and place order
  await page.getByRole('link', { name: 'Cart' }).click()
  await expect(page.getByTestId('cart-empty')).toBeHidden()
  await page.getByTestId('place-order').click()
  await expect(page).toHaveURL(/checkout\/success/)
  await expect(page.getByTestId('order-number')).toBeVisible()
  await expect(page.getByRole('link', { name: /WhatsApp/i })).toBeVisible()
})
