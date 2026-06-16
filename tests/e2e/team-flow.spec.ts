import { test, expect } from '@playwright/test'
import { execSync } from 'node:child_process'

// TEAM_MEMBER role flow: admin provisions a team member, who then signs in,
// lands on /team, and is blocked from /admin by the cross-role guard. Also
// exercises proxy.ts + the DAL auth boundary for a non-admin role.

const ADMIN_EMAIL = 'e2e-admin@example.com'
const ADMIN_PASSWORD = 'E2eAdmin!2026'

test.beforeAll(() => {
  // Non-destructive upsert of a UI-loginable admin. (The default seed admin is
  // `admin@localhost`, which Zod's z.email() rejects, so it can't sign in via
  // the login form.) Avoids `prisma migrate reset` (drops the dev DB + now
  // requires explicit consent).
  execSync('npx tsx scripts/ensure-e2e-admin.ts', {
    stdio: 'inherit',
    env: {
      ...process.env,
      E2E_ADMIN_EMAIL: ADMIN_EMAIL,
      E2E_ADMIN_PASSWORD: ADMIN_PASSWORD,
    },
  })
})

test('admin creates a team member who can sign in and is blocked from /admin', async ({
  page,
  browser,
}) => {
  const teamEmail = `team-${Date.now()}@example.com`
  const teamPassword = 'TeamPass!2026'

  // ── 1. Admin signs in ───────────────────────────────────────────────
  await page.goto('/login')
  await page.getByLabel('Email').fill(ADMIN_EMAIL)
  await page.getByLabel('Password').fill(ADMIN_PASSWORD)
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page).toHaveURL(/\/admin$/, { timeout: 90_000 })

  // ── 2. Admin creates a team member ──────────────────────────────────
  await page.getByRole('link', { name: 'Team' }).click()
  await expect(page).toHaveURL(/\/admin\/team$/, { timeout: 90_000 })

  await page.getByLabel('Full name').fill('Team Tester')
  await page.getByLabel('Email').fill(teamEmail)
  await page.getByLabel('Temp password').fill(teamPassword)
  await page.getByRole('button', { name: /add team member/i }).click()
  await expect(page.getByText(/team member created/i)).toBeVisible({ timeout: 60_000 })

  // ── 3. Fresh context: the team member signs in ──────────────────────
  const ctx = await browser.newContext()
  const teamPage = await ctx.newPage()
  await teamPage.goto('/login')
  await teamPage.getByLabel('Email').fill(teamEmail)
  await teamPage.getByLabel('Password').fill(teamPassword)
  await teamPage.getByRole('button', { name: /sign in/i }).click()
  await expect(teamPage).toHaveURL(/\/team$/, { timeout: 90_000 })

  // ── 4. Cross-role guard: team hitting /admin → bounced to /team ─────
  await teamPage.goto('/admin')
  await expect(teamPage).toHaveURL(/\/team$/, { timeout: 60_000 })
  await ctx.close()
})
