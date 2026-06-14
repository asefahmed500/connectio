import { test, expect } from '@playwright/test'
import { execSync } from 'node:child_process'

// One full happy-path run through the system. Covers every auth component
// we've built so far: login (SUPER_ADMIN) → invite creation → registration
// → CLIENT dashboard. Also implicitly tests proxy.ts, the DAL security
// boundary, and the registration transaction.

const ADMIN_EMAIL = 'admin@localhost'
const ADMIN_PASSWORD = 'admin-password-123'

test.beforeAll(() => {
  // Reset DB to a known state and re-seed the admin.
  execSync('npx prisma migrate reset --force --skip-generate', {
    stdio: 'inherit',
    env: {
      ...process.env,
      SEED_ADMIN_EMAIL: ADMIN_EMAIL,
      SEED_ADMIN_PASSWORD: ADMIN_PASSWORD,
    },
  })
})

test('admin logs in, creates invite, client registers via the invite link', async ({
  page,
  context,
  browser,
}) => {
  // ── 1. Admin logs in ────────────────────────────────────────────────
  await page.goto('/login')
  await page.getByLabel('Email').fill(ADMIN_EMAIL)
  await page.getByLabel('Password').fill(ADMIN_PASSWORD)
  await page.getByRole('button', { name: /sign in/i }).click()

  await expect(page).toHaveURL(/\/admin$/, { timeout: 10_000 })
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()

  // ── 2. Proxy blocks anon from /admin (sanity check) ────────────────
  const anonContext = await browser.newContext()
  const anonPage = await anonContext.newPage()
  await anonPage.goto('/admin')
  await expect(anonPage).toHaveURL(/\/login/, { timeout: 5_000 })
  await anonContext.close()

  // ── 3. Admin creates an invite ─────────────────────────────────────
  await page.getByRole('link', { name: 'Invites' }).click()
  await expect(page).toHaveURL(/\/admin\/invites$/)

  const clientEmail = `client-${Date.now()}@example.com`
  await page.getByLabel('Client email').fill(clientEmail)
  await page.getByLabel('Company').fill('Acme Test Corp')
  await page.getByLabel('Contact name').fill('Jane Testperson')
  await page.getByRole('button', { name: /create invite/i }).click()

  // Wait for the invite link to render in the success state.
  const link = await page.locator('code').first().textContent()
  expect(link).toMatch(/\/invite\//)

  // ── 4. Anon user follows the invite link and registers ─────────────
  // Use a fresh context so the admin session cookie isn't sent.
  const regContext = await browser.newContext()
  const regPage = await regContext.newPage()
  await regPage.goto(link!)
  await expect(
    regPage.getByText(/invited to set up an account for/i),
  ).toBeVisible()
  await expect(regPage.getByLabel('Email')).toHaveValue(clientEmail)

  const password = 'TestPassword!2026'
  await regPage.getByLabel('Your name').fill('Jane Testperson')
  await regPage.getByLabel('Password').fill(password)
  await regPage.getByRole('button', { name: /create account/i }).click()

  // ── 5. Client lands on their dashboard ─────────────────────────────
  await expect(regPage).toHaveURL(/\/dashboard\/visitor\//, { timeout: 10_000 })
  await expect(
    regPage.getByRole('heading', { name: 'Your dashboard' }),
  ).toBeVisible()

  // ── 6. Client cannot reach /admin (proxy + DAL) ────────────────────
  await regPage.goto('/admin')
  // Proxy redirects to dashboard instead of /admin (cross-role guard).
  await expect(regPage).toHaveURL(/\/dashboard\/visitor\//, { timeout: 5_000 })
  await regContext.close()
})

test('wrong password fails with a generic error', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill(ADMIN_EMAIL)
  await page.getByLabel('Password').fill('definitely-wrong')
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page.getByText(/invalid email or password/i)).toBeVisible()
  await expect(page).toHaveURL(/\/login/)
})

test('expired or nonexistent invite link returns 404', async ({ page }) => {
  const response = await page.goto('/invite/this-slug-does-not-exist')
  expect(response?.status()).toBe(404)
})
