import 'server-only'
import { createHmac, randomBytes } from 'crypto'

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

function base32Encode(buffer: Buffer): string {
  let bits = 0
  let value = 0
  let output = ''
  for (const byte of buffer) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31]
  }
  return output
}

function base32Decode(input: string): Buffer {
  const clean = input.replace(/=+$/, '').toUpperCase().replace(/\s/g, '')
  let bits = 0
  let value = 0
  const bytes: number[] = []
  for (const char of clean) {
    const idx = BASE32_ALPHABET.indexOf(char)
    if (idx === -1) continue
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return Buffer.from(bytes)
}

export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20))
}

export function getTotpAuthUri(secret: string, email: string, issuer = 'ClientConnect'): string {
  const label = encodeURIComponent(`${issuer}:${email}`)
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: '6',
    period: '30',
  })
  return `otpauth://totp/${label}?${params.toString()}`
}

function hotp(secret: string, counter: number): string {
  const key = base32Decode(secret)
  const buf = Buffer.alloc(8)
  let c = counter
  for (let i = 7; i >= 0; i--) {
    buf[i] = c & 0xff
    c = Math.floor(c / 256)
  }
  const hmac = createHmac('sha1', key).update(buf).digest()
  const offset = hmac[hmac.length - 1]! & 0xf
  const code =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff)
  return (code % 1000000).toString().padStart(6, '0')
}

export function verifyTotp(secret: string, token: string, window = 1): boolean {
  const clean = token.replace(/\s/g, '')
  if (!/^\d{6}$/.test(clean)) return false

  const counter = Math.floor(Date.now() / 30000)
  for (let i = -window; i <= window; i++) {
    if (hotp(secret, counter + i) === clean) return true
  }
  return false
}

export function generateBackupCodes(count = 10): string[] {
  return Array.from({ length: count }, () =>
    randomBytes(5).toString('hex').toUpperCase().replace(/(.{5})/, '$1-'),
  )
}

export async function hashBackupCodes(codes: string[]): Promise<string[]> {
  const { hashRefreshToken } = await import('@/lib/auth/tokens')
  return Promise.all(codes.map((c) => hashRefreshToken(c.replace(/-/g, ''))))
}

export function normalizeBackupCode(code: string): string {
  return code.replace(/[-\s]/g, '').toUpperCase()
}

export async function totpToDataUrl(uri: string): Promise<string> {
  // Dynamic import keeps the heavy QR lib out of the auth hot path.
  const QRCode = (await import('qrcode')).default
  return QRCode.toDataURL(uri, { width: 200, margin: 1 })
}
