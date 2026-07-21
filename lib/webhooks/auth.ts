import 'server-only'
import { createHmac, timingSafeEqual } from 'crypto'

/**
 * Verify an HMAC-SHA256 signature over a raw request body, using a shared
 * secret. Constant-time comparison. Returns false if the secret is unset, the
 * header is missing/malformed, or the digest does not match.
 *
 * Accepts headers in either of the two common shapes:
 *   - "sha256=<hex>"  (GitHub/Stripe style — pass the whole header value)
 *   - "<hex>"         (bare hex)
 */
export function verifyHmacSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string | undefined,
): boolean {
  if (!secret) return false
  if (!signatureHeader) return false

  const expected =
    signatureHeader.startsWith('sha256=') || signatureHeader.startsWith('sha256 ')
      ? signatureHeader.slice(7)
      : signatureHeader

  // Hex digest = 64 chars for SHA-256.
  if (expected.length !== 64 || !/^[0-9a-fA-F]{64}$/.test(expected)) return false

  const computed = createHmac('sha256', secret).update(rawBody).digest('hex')

  const a = Buffer.from(computed, 'hex')
  const b = Buffer.from(expected, 'hex')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/**
 * Verify an `Authorization: Bearer <token>` header against a shared secret.
 * Constant-time comparison. Returns false if the secret is unset, the header
 * is missing/malformed, or the token does not match.
 *
 * Use this for cron-job endpoints where the caller is a trusted scheduler
 * (e.g. Vercel Cron) configured with the same secret.
 */
export function verifyBearerToken(
  authHeader: string | null,
  secret: string | undefined,
): boolean {
  if (!secret) return false
  if (!authHeader) return false

  const prefix = authHeader.slice(0, 7)
  if (prefix !== 'Bearer ' && prefix !== 'bearer ') return false
  const presented = authHeader.slice(7)

  if (presented.length === 0 || presented.length > 256) return false

  const a = Buffer.from(secret)
  const b = Buffer.from(presented)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
