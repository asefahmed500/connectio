import 'server-only'

/**
 * CSRF defense for cookie-authenticated mutation routes (POST/PUT/DELETE/PATCH).
 *
 * Server actions are already CSRF-protected by Next.js via the `Next-Action`
 * header. Raw API routes that mutate state need an explicit check — this is
 * defense-in-depth on top of the `SameSite=Lax` cookies set in
 * lib/auth/session.ts. SameSite=Lax blocks the most common CSRF vector
 * (cross-site form POST); this Origin check additionally rejects cross-origin
 * fetches from any browser that ignores SameSite, and rejects malformed Origin
 * headers from any source.
 *
 * Pattern (in a Route Handler):
 *   if (!checkSameOrigin(req.headers)) {
 *     return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 })
 *   }
 *
 * Same-origin is established when EITHER:
 *   (a) `Sec-Fetch-Site` is `same-origin` or `same-site` or `none` (preferred),
 *   OR
 *   (b) the `Origin` header host exactly matches the `Host` header.
 *
 * Fail-closed if neither signal is present or they're contradictory.
 *
 * SECURITY: `Host` is trusted; `X-Forwarded-Host` is NOT (it is
 * attacker-controllable on misconfigured reverse proxies). If you deploy
 * behind a proxy that overwrites Host, configure the proxy correctly rather
 * than re-enabling the X-Forwarded-Host fallback.
 */
export function checkSameOrigin(headers: Headers): boolean {
  // (a) Strongest signal: Sec-Fetch-Site. Modern browsers send this on every
  //     fetch. `none` covers user-initiated navigations.
  const sfs = headers.get('sec-fetch-site')
  if (sfs === 'same-origin' || sfs === 'same-site' || sfs === 'none') {
    return true
  }
  if (sfs === 'cross-site') {
    return false
  }

  // (b) Origin vs Host. Host only — never X-Forwarded-Host.
  const host = headers.get('host')
  const origin = headers.get('origin')
  if (!origin || !host) return false
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}
