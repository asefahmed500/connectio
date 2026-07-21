import 'server-only'
import { SignJWT, jwtVerify, errors as joseErrors } from 'jose'
import type { UserRole } from '@prisma/client'

const encoder = new TextEncoder()

function getSecret(): Uint8Array {
  // Read fresh each call so secret rotation doesn't require restart.
  // Boot-time validation in lib/auth/env.ts enforces length.
  const raw = process.env.AUTH_JWT_SECRET
  if (!raw || raw.length < 32) {
    throw new Error('AUTH_JWT_SECRET missing or too short')
  }
  return encoder.encode(raw)
}

export type AccessClaims = {
  sub: string
  role: UserRole
  clientId?: string
  ver: number
  iat: number
  exp: number
  jti: string
}

export type VerifyResult =
  | { ok: true; claims: AccessClaims }
  | { ok: false; reason: 'missing' | 'expired' | 'invalid' }

const ACCESS_TTL_SECONDS = 60 * 60 * 24 // 24h

export async function signAccessToken(input: {
  sub: string
  role: UserRole
  clientId?: string
  tokenVersion: number
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  return new SignJWT({
    sub: input.sub,
    role: input.role,
    clientId: input.clientId,
    ver: input.tokenVersion,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setExpirationTime(now + ACCESS_TTL_SECONDS)
    .setJti(crypto.randomUUID())
    .sign(getSecret())
}

export async function verifyAccessToken(token: string | undefined): Promise<VerifyResult> {
  if (!token) return { ok: false, reason: 'missing' }
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ['HS256'] })
    return {
      ok: true,
      claims: {
        sub: payload.sub as string,
        role: payload.role as UserRole,
        clientId: payload.clientId as string | undefined,
        ver: payload.ver as number,
        iat: payload.iat!,
        exp: payload.exp!,
        jti: payload.jti as string,
      },
    }
  } catch (err) {
    if (err instanceof joseErrors.JWTExpired) return { ok: false, reason: 'expired' }
    return { ok: false, reason: 'invalid' }
  }
}

export function generateRefreshToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return Buffer.from(bytes).toString('base64url')
}

export async function hashRefreshToken(token: string): Promise<string> {
  // SHA-256 is sufficient for an opaque stored secret with 32 bytes of entropy.
  // (Argon2 here would be overkill — refresh tokens are already high-entropy.)
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(token))
  return Buffer.from(digest).toString('hex')
}

// ─────────────────────────────────────────────────────────────────
// MFA pending token (short-lived, single purpose: complete 2FA step)
// ─────────────────────────────────────────────────────────────────

const MFA_TTL_SECONDS = 5 * 60 // 5 minutes to complete the challenge

export type MfaClaims = {
  sub: string
  purpose: 'mfa'
  role: UserRole
  clientId?: string
  ver: number
  iat: number
  exp: number
  jti: string
}

export async function signMfaToken(input: {
  sub: string
  role: UserRole
  clientId?: string
  tokenVersion: number
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  return new SignJWT({
    sub: input.sub,
    purpose: 'mfa',
    role: input.role,
    clientId: input.clientId,
    ver: input.tokenVersion,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setExpirationTime(now + MFA_TTL_SECONDS)
    .setJti(crypto.randomUUID())
    .sign(getSecret())
}

export async function verifyMfaToken(token: string | undefined): Promise<{
  ok: boolean
  claims?: MfaClaims
  reason?: string
}> {
  if (!token) return { ok: false, reason: 'missing' }
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ['HS256'] })
    if (payload.purpose !== 'mfa') return { ok: false, reason: 'invalid' }
    return {
      ok: true,
      claims: {
        sub: payload.sub as string,
        purpose: 'mfa',
        role: payload.role as UserRole,
        clientId: payload.clientId as string | undefined,
        ver: payload.ver as number,
        iat: payload.iat!,
        exp: payload.exp!,
        jti: payload.jti as string,
      },
    }
  } catch {
    return { ok: false, reason: 'invalid' }
  }
}

// ─────────────────────────────────────────────────────────────────
// Password reset token (short-lived, issued after OTP verification)
// ─────────────────────────────────────────────────────────────────

const RESET_TTL_SECONDS = 5 * 60 // 5 minutes to complete the password form

export type ResetClaims = {
  pwdResetId: string
  purpose: 'reset'
  iat: number
  exp: number
  jti: string
}

export async function signResetToken(passwordResetTokenId: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  return new SignJWT({
    pwdResetId: passwordResetTokenId,
    purpose: 'reset',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setExpirationTime(now + RESET_TTL_SECONDS)
    .setJti(crypto.randomUUID())
    .sign(getSecret())
}

export async function verifyResetTokenCookie(token: string | undefined): Promise<{
  ok: boolean
  claims?: ResetClaims
  reason?: string
}> {
  if (!token) return { ok: false, reason: 'missing' }
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ['HS256'] })
    if (payload.purpose !== 'reset') return { ok: false, reason: 'invalid' }
    return {
      ok: true,
      claims: {
        pwdResetId: payload.pwdResetId as string,
        purpose: 'reset',
        iat: payload.iat!,
        exp: payload.exp!,
        jti: payload.jti as string,
      },
    }
  } catch {
    return { ok: false, reason: 'invalid' }
  }
}
