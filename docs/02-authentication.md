# 02 — Authentication

**Status:** Draft
**Libraries:** `jose` (JWT sign/verify) · `argon2` (password hashing) · Zod (validation)
**Storage:** Two HttpOnly cookies: `access_token` (24h) + `refresh_token` (7d, rotating). Refresh tokens are also recorded in the `Session` table so they can be revoked.

This doc covers credential authentication only. SSO/OAuth is a Phase 3 concern — the design accommodates adding it without rework.

## Threat model

| Threat | Mitigation |
|--------|------------|
| Password leak from DB | argon2id hash (memory-hard, slow to brute) |
| Token theft from XSS | HttpOnly + Secure + SameSite=Lax cookies (no JS access) |
| Token theft from network | HTTPS-only in prod; `Secure: true` enforced |
| Session fixation | Refresh token rotates on every use; old token revoked |
| CSRF on mutations | Server Actions check `Origin` vs `Host`; cookies are `SameSite=Lax` |
| Credential stuffing | Rate limit `/login` per-IP and per-email (see `10-security.md`) |
| Stolen refresh token after user logout | `Session.revokedAt` set on logout; refresh rejected if revoked |
| Privilege escalation via stale token | Access token embeds `role` and `clientId`; short-lived (24h). Force re-login after role change. |

## Token shape

### Access token (JWT, HS256)

```ts
type AccessClaims = {
  sub: string         // userId
  role: UserRole      // 'SUPER_ADMIN' | 'TEAM_MEMBER' | 'CLIENT'
  clientId?: string   // present only for CLIENT role
  iat: number         // issued-at (seconds)
  exp: number         // expiry (seconds) — iat + 24h
  jti: string         // token id (for audit correlation)
}
```

- Signed with `AUTH_JWT_SECRET` (≥ 32 bytes, `openssl rand -base64 32`).
- Stateless: verified in the DAL without a DB lookup. This is what makes the DAL fast.
- Contains the minimum needed for authorization. **No PII** (no email, no name).

### Refresh token (opaque random value, not a JWT)

- 32 random bytes, base64url-encoded.
- Stored in DB only as `argon2id(refreshToken)` — never the raw value.
- Rotated on every successful refresh; old token's `revokedAt` set.
- Lifetime: 7 days. Sliding — each refresh resets the 7-day clock, but absolute max from first issue is 30 days.

## Cookie settings

```ts
const ACCESS_COOKIE   = 'access_token'
const REFRESH_COOKIE  = 'refresh_token'

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
}

const accessCookieOpts  = { ...cookieOptions, maxAge: 60 * 60 * 24 }          // 24h
const refreshCookieOpts = { ...cookieOptions, maxAge: 60 * 60 * 24 * 7 }      // 7d
```

Notes:
- `Secure: false` in dev so HTTP-on-localhost works.
- `SameSite: Lax` (not `Strict`) so users can follow email links back into the app.
- `Path: /` so the cookie is sent to every route including `/api/*`.

## Module layout

```
lib/
├── auth/
│   ├── password.ts        hashPassword, verifyPassword (argon2id)
│   ├── tokens.ts          signAccessToken, verifyAccessToken (jose)
│                           generateRefreshToken, hashRefreshToken, verifyRefreshToken
│   ├── session.ts         createSession, rotateSession, deleteSession, refreshSession
│   └── dal.ts             getCurrentUser, requireRole, requireClientAccess
└── db.ts                  Prisma client singleton
```

All files in `lib/auth/*` start with `import 'server-only'`.

## Password hashing (argon2id)

```ts
// lib/auth/password.ts
import 'server-only'
import argon2 from 'argon2'

const params = {
  type: argon2.argon2id,
  memoryCost: 19_456,    // 19 MiB — OWASP minimum as of 2023
  timeCost: 2,           // 2 iterations
  parallelism: 1,
}

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, params)
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  // verify() is constant-time on the password; do the boolean check ourselves
  // so we never short-circuit on hash format errors.
  try {
    return await argon2.verify(hash, password)
  } catch {
    return false
  }
}
```

Password policy (enforced in Zod, see `04-invites-and-registration.md`):
- ≥ 12 chars
- ≥ 1 letter, ≥ 1 digit, ≥ 1 symbol
- Not in a small blocklist of common passwords (`password`, `12345678`, etc.)
- No max length beyond DB column size (1024 chars — argon2 has its own limits).

## JWT sign/verify (jose)

```ts
// lib/auth/tokens.ts
import 'server-only'
import { SignJWT, jwtVerify, errors as joseErrors } from 'jose'

const secret = new TextEncoder().encode(process.env.AUTH_JWT_SECRET!)

export type AccessClaims = {
  sub: string
  role: UserRole
  clientId?: string
  jti: string
}

export async function signAccessToken(claims: Omit<AccessClaims, 'iat' | 'exp' | 'jti'>) {
  const now = Math.floor(Date.now() / 1000)
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setExpirationTime(now + 60 * 60 * 24)   // 24h
    .setJti(crypto.randomUUID())
    .sign(secret)
}

export async function verifyAccessToken(token: string | undefined): Promise<AccessClaims | null> {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] })
    return payload as unknown as AccessClaims
  } catch (err) {
    if (err instanceof joseErrors.JWTExpired) return 'expired' as unknown as null // see note
    return null
  }
}

// Refresh tokens — opaque, not JWT
export function generateRefreshToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return Buffer.from(bytes).toString('base64url')
}
```

> **Note on expired tokens:** the DAL distinguishes "no token" (treat as anonymous) from "expired token" (try refresh). `verifyAccessToken` returns a tagged result in practice — see the full implementation in `lib/auth/tokens.ts`.

## Session lifecycle

### Login (Server Action)

```ts
// app/(auth)/login/actions.ts
'use server'

import { z } from 'zod'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyPassword } from '@/lib/auth/password'
import { signAccessToken, generateRefreshToken } from '@/lib/auth/tokens'
import { hashRefreshToken } from '@/lib/auth/session'
import { prisma } from '@/lib/db'
import { rateLimit } from '@/lib/ratelimit'

const Schema = z.object({
  email: z.email(),
  password: z.string().min(1),
})

export async function loginAction(prevState: unknown, formData: FormData) {
  const parsed = Schema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })
  if (!parsed.success) return { error: 'Invalid input' }

  const { email, password } = parsed.data

  // Rate limit BEFORE the DB lookup. Per-IP and per-email buckets.
  const ok = await rateLimit(`login:ip:${await clientIp()}`, { limit: 10, window: '1m' })
    .and(rateLimit(`login:email:${email}`, { limit: 5, window: '5m' }))
  if (!ok) return { error: 'Too many attempts. Try again later.' }

  const user = await prisma.user.findUnique({ where: { email } })
  // Always run a dummy verify to avoid timing-based user enumeration.
  const valid = user
    ? await verifyPassword(user.passwordHash, password)
    : await verifyPassword(DUMMY_HASH, password)

  if (!user || !valid) return { error: 'Invalid email or password' }

  await prisma.session.deleteMany({ where: { userId: user.id, expiresAt: { lt: new Date() } } })

  const access = await signAccessToken({ sub: user.id, role: user.role, clientId: user.clientId })
  const refresh = generateRefreshToken()
  await prisma.session.create({
    data: {
      userId: user.id,
      refreshTokenHash: await hashRefreshToken(refresh),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      ip: await clientIp(),
      userAgent: await userAgent(),
    },
  })

  const cs = await cookies()
  cs.set('access_token', access, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 })
  cs.set('refresh_token', refresh, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 7 })

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
  await writeAudit('USER_LOGIN', user.id, 'User', user.id)

  redirect(dashboardForRole(user.role))   // /admin · /team · /dashboard/visitor/<slug>
}
```

Key points:
- **No early-return on user-not-found.** Always run `verifyPassword` against a precomputed `DUMMY_HASH` to keep timing constant.
- **Rate limit before DB lookup** to deny cheap user-existence oracles.
- **Delete expired sessions opportunistically** on login (cheap GC).
- **Set cookies via `cookies()` API**, not raw `Set-Cookie` headers — Next 16 manages the request scope.
- **`redirect()` is called outside any try/catch** (see Next 16 error-handling skill: navigation APIs throw).

### Refresh (`/api/auth/refresh/route.ts`)

Route handler — called by a client-side interceptor when an access token expires, or by the proxy when it sees an expired access token with a valid refresh cookie present.

```ts
// app/api/auth/refresh/route.ts
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/db'
import { verifyRefreshToken, hashRefreshToken, rotateSession } from '@/lib/auth/session'
import { signAccessToken, generateRefreshToken } from '@/lib/auth/tokens'

export async function POST() {
  const cs = await cookies()
  const refreshCookie = cs.get('refresh_token')?.value
  if (!refreshCookie) return NextResponse.json({ error: 'No refresh token' }, { status: 401 })

  const session = await prisma.session.findFirst({
    where: { refreshTokenHash: await hashRefreshToken(refreshCookie) },
    include: { user: { include: { client: true } } },
  })

  // Validate: exists, not revoked, not expired
  if (!session || session.revokedAt || session.expiresAt < new Date()) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
  }

  // Rotate: revoke old, issue new
  const newRefresh = generateRefreshToken()
  await prisma.$transaction([
    prisma.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } }),
    prisma.session.create({
      data: {
        userId: session.userId,
        refreshTokenHash: await hashRefreshToken(newRefresh),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    }),
  ])

  const access = await signAccessToken({
    sub: session.user.id,
    role: session.user.role,
    clientId: session.user.client?.id,
  })

  const res = NextResponse.json({ ok: true })
  res.cookies.set('access_token', access, { /* opts */ })
  res.cookies.set('refresh_token', newRefresh, { /* opts */ })
  return res
}
```

### Logout

```ts
// app/(auth)/logout/actions.ts
'use server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'

export async function logoutAction() {
  const cs = await cookies()
  const refresh = cs.get('refresh_token')?.value
  if (refresh) {
    const hash = await hashRefreshToken(refresh)
    await prisma.session.updateMany({
      where: { refreshTokenHash: hash, revokedAt: null },
      data: { revokedAt: new Date() },
    })
  }
  cs.delete('access_token')
  cs.delete('refresh_token')
  redirect('/login')
}
```

## Boot-time secret validation

```ts
// lib/auth/env.ts
import 'server-only'

const REQUIRED = ['AUTH_JWT_SECRET', 'DATABASE_URL', 'ARGON2_SECRET_PEPPER'] as const

for (const key of REQUIRED) {
  if (!process.env[key] || process.env[key]!.length < 16) {
    throw new Error(`Missing/weak env var: ${key}`)
  }
}
```

Imported from `instrumentation.ts` so the app refuses to start with bad secrets. See `12-env-and-config.md`.

## Password reset

Out of scope for v1 but the design supports it:

1. User clicks "Forgot password?" → enters email.
2. App generates a single-use `PasswordResetToken` (cuid + hash in DB, 15-min TTL).
3. Email sent with `/reset-password?token=...` link.
4. On submit, server verifies token, sets new `passwordHash`, **revokes all sessions for the user** (forces re-login everywhere).

The `Session` table is what makes step 4 cheap.

## Open questions

- **PEPPER for argon2?** Adds defense-in-depth if the DB is leaked but env vars aren't. Recommend `AUTH_PASSWORD_PEPPER` env var, applied via HMAC before hashing. Documented but not implemented until first security review.
- **Email verification on registration?** PRD assumes the invite email *is* the verification. Acceptable for v1; flag if we add public sign-up later.
