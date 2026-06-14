// Slug generation + validation. See docs/04-invites-and-registration.md.

const RESERVED = new Set([
  'admin', 'team', 'api', 'auth', 'invite', 'dashboard',
  'login', 'register', 'settings', 'www', 'mail', 'static',
  'superuser', 'root', 'support', 'help', 'about', 'blog',
  'privacy', 'terms', 'security', 'status',
])

const SLUG_REGEX = /^[a-z0-9-]+$/

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
}

export function isValidSlug(slug: string): boolean {
  return (
    slug.length >= 3 &&
    slug.length <= 32 &&
    SLUG_REGEX.test(slug) &&
    !RESERVED.has(slug)
  )
}

export function isReservedSlug(slug: string): boolean {
  return RESERVED.has(slug.toLowerCase())
}

export function randomSlug(length: number): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  let out = ''
  for (const b of bytes) out += alphabet[b % alphabet.length]
  return out
}
