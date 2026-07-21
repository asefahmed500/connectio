import { describe, expect, it } from 'vitest'
import { checkSameOrigin } from '@/lib/auth/csrf'

function makeHeaders(opts: { host?: string; origin?: string; forwardedHost?: string }): Headers {
  const h = new Headers()
  if (opts.host) h.set('host', opts.host)
  if (opts.origin) h.set('origin', opts.origin)
  if (opts.forwardedHost) h.set('x-forwarded-host', opts.forwardedHost)
  return h
}

describe('checkSameOrigin', () => {
  it('accepts when Origin host matches Host', () => {
    const h = makeHeaders({ host: 'connectio.example.com', origin: 'https://connectio.example.com' })
    expect(checkSameOrigin(h)).toBe(true)
  })

  it('accepts when Origin matches X-Forwarded-Host (proxy case)', () => {
    const h = makeHeaders({
      forwardedHost: 'app.example.com',
      origin: 'https://app.example.com',
    })
    expect(checkSameOrigin(h)).toBe(true)
  })

  it('accepts different schemes on the same host', () => {
    const h = makeHeaders({ host: 'localhost:3000', origin: 'http://localhost:3000' })
    expect(checkSameOrigin(h)).toBe(true)
  })

  it('accepts different ports on the same host? NO — port is part of host', () => {
    // Documents the URL.host behaviour: includes port. If you serve on
    // localhost:3000 but the browser sends Origin http://localhost, that's
    // a different host and will be rejected. This is the correct behaviour.
    const h = makeHeaders({ host: 'localhost:3000', origin: 'http://localhost' })
    expect(checkSameOrigin(h)).toBe(false)
  })

  it('rejects cross-origin requests', () => {
    const h = makeHeaders({ host: 'app.example.com', origin: 'https://evil.example.com' })
    expect(checkSameOrigin(h)).toBe(false)
  })

  it('rejects when Origin is missing (fail-closed)', () => {
    const h = makeHeaders({ host: 'app.example.com' })
    expect(checkSameOrigin(h)).toBe(false)
  })

  it('rejects when Host is missing', () => {
    const h = makeHeaders({ origin: 'https://app.example.com' })
    expect(checkSameOrigin(h)).toBe(false)
  })

  it('rejects malformed Origin', () => {
    const h = makeHeaders({ host: 'app.example.com', origin: 'not-a-url' })
    expect(checkSameOrigin(h)).toBe(false)
  })

  it('rejects subdomain mismatch (Origin is subdomain of Host)', () => {
    const h = makeHeaders({ host: 'example.com', origin: 'https://app.example.com' })
    expect(checkSameOrigin(h)).toBe(false)
  })

  it('rejects parent-domain Origin against subdomain Host', () => {
    const h = makeHeaders({ host: 'app.example.com', origin: 'https://example.com' })
    expect(checkSameOrigin(h)).toBe(false)
  })
})
