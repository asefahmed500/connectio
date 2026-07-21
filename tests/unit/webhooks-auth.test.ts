import { describe, expect, it } from 'vitest'
import { createHmac } from 'crypto'
import { verifyHmacSignature, verifyBearerToken } from '@/lib/webhooks/auth'

const SECRET = 'shared-secret-value'

function sign(body: string, secret: string = SECRET): string {
  return createHmac('sha256', secret).update(body).digest('hex')
}

describe('verifyHmacSignature', () => {
  it('accepts a valid bare-hex signature', () => {
    const body = JSON.stringify({ to: 'a@b', subject: 'x', text: 'y' })
    expect(verifyHmacSignature(body, sign(body), SECRET)).toBe(true)
  })

  it('accepts a valid sha256=<hex> signature (GitHub/Stripe style)', () => {
    const body = 'payload'
    expect(verifyHmacSignature(body, `sha256=${sign(body)}`, SECRET)).toBe(true)
  })

  it('rejects a signature computed with a different secret', () => {
    const body = 'payload'
    const wrong = createHmac('sha256', 'different-secret').update(body).digest('hex')
    expect(verifyHmacSignature(body, wrong, SECRET)).toBe(false)
  })

  it('rejects a signature over tampered body', () => {
    const sig = sign('original')
    expect(verifyHmacSignature('tampered', sig, SECRET)).toBe(false)
  })

  it('rejects when secret is unset (fail-closed)', () => {
    const body = 'payload'
    expect(verifyHmacSignature(body, sign(body), undefined)).toBe(false)
  })

  it('rejects when header is missing', () => {
    expect(verifyHmacSignature('payload', null, SECRET)).toBe(false)
  })

  it('rejects malformed signatures (wrong length / non-hex)', () => {
    expect(verifyHmacSignature('payload', 'nope', SECRET)).toBe(false)
    expect(verifyHmacSignature('payload', 'x'.repeat(64), SECRET)).toBe(false)
    expect(verifyHmacSignature('payload', `sha256=${'z'.repeat(64)}`, SECRET)).toBe(false)
  })

  it('does not throw on adversarial input', () => {
    expect(() =>
      verifyHmacSignature('', 'sha256=', SECRET),
    ).not.toThrow()
    expect(() =>
      verifyHmacSignature('', 'sha256=' + 'a'.repeat(1000), SECRET),
    ).not.toThrow()
  })
})

describe('verifyBearerToken', () => {
  it('accepts a valid Bearer token', () => {
    expect(verifyBearerToken(`Bearer ${SECRET}`, SECRET)).toBe(true)
  })

  it('is case-insensitive on the scheme', () => {
    expect(verifyBearerToken(`bearer ${SECRET}`, SECRET)).toBe(true)
  })

  it('rejects a wrong token (constant-time safe path)', () => {
    expect(verifyBearerToken('Bearer wrong-token', SECRET)).toBe(false)
  })

  it('rejects when secret is unset (fail-closed)', () => {
    expect(verifyBearerToken(`Bearer ${SECRET}`, undefined)).toBe(false)
  })

  it('rejects missing header', () => {
    expect(verifyBearerToken(null, SECRET)).toBe(false)
  })

  it('rejects other auth schemes', () => {
    expect(verifyBearerToken(`Basic ${SECRET}`, SECRET)).toBe(false)
  })

  it('rejects empty token after prefix', () => {
    expect(verifyBearerToken('Bearer ', SECRET)).toBe(false)
  })

  it('rejects abnormally long tokens (>256 chars) before comparing', () => {
    expect(verifyBearerToken(`Bearer ${'x'.repeat(300)}`, SECRET)).toBe(false)
  })
})
