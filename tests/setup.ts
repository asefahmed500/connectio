// Global test setup. Loads env vars the auth modules read at module-eval time.
// NOTE: Vitest already sets process.env.NODE_ENV='test' before this runs.
//
// Integration tests run against a dedicated `connectio_test` database (created
// + migrated out of band) so they never touch dev data. Override with
// DATABASE_URL if your local superuser/password differ.

import { vi } from 'vitest'

process.env.AUTH_JWT_SECRET ??= 'test-secret-32-chars-min-here-xxxxxx'
process.env.DATABASE_URL ??=
  'postgresql://postgres:asef@localhost:5432/connectio_test?schema=public'
// Silence the email stub logs during tests.
process.env.SMTP_HOST ??= ''

// Global mock for `next/headers`. Registering it here (in setupFiles) means it
// is active before ANY test-file import resolves — so modules that statically
// import `cookies`/`headers` (e.g. lib/dal/session, lib/audit) get the mock no
// matter their import order. The current session token lives on globalThis so
// tests can swap the signed-in user via `signInAs` without import-order races.
;(globalThis as unknown as { __ccTestToken?: string }).__ccTestToken = undefined

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => {
      const token = (globalThis as unknown as { __ccTestToken?: string }).__ccTestToken
      return name === 'access_token' && token ? { value: token } : undefined
    },
  }),
  headers: async () => ({ get: () => null }),
}))
