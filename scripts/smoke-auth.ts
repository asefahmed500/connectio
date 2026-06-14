// Smoke test for the auth foundation. Run with: npx tsx scripts/smoke-auth.ts
// Verifies password hashing, JWT sign/verify, and refresh-token hashing all work.
// Safe to delete once there's a proper test suite (Tier 0 testing milestone).

import { hashPassword, verifyPassword } from '../lib/auth/password'
import { signAccessToken, verifyAccessToken, generateRefreshToken, hashRefreshToken } from '../lib/auth/tokens'

async function main() {
  console.log('--- password ---')
  const hash = await hashPassword('hello-world-123')
  console.log('hash ok:', hash.startsWith('$argon2id$'))
  console.log('verify correct:', await verifyPassword(hash, 'hello-world-123'))
  console.log('verify wrong:', await verifyPassword(hash, 'wrong'))
  console.log('verify null (dummy):', await verifyPassword(null, 'anything'))

  console.log('--- access token ---')
  const token = await signAccessToken({ sub: 'user_1', role: 'SUPER_ADMIN', tokenVersion: 0 })
  console.log('token len:', token.length)
  const result = await verifyAccessToken(token)
  if (result.ok) {
    console.log('claims:', JSON.stringify({ sub: result.claims.sub, role: result.claims.role, ver: result.claims.ver }))
  } else {
    console.log('verify failed:', result.reason)
  }
  console.log('garbage token:', JSON.stringify(await verifyAccessToken('not.a.token')))
  console.log('missing token:', JSON.stringify(await verifyAccessToken(undefined)))

  console.log('--- refresh token ---')
  const rt = generateRefreshToken()
  const rthash = await hashRefreshToken(rt)
  console.log('refresh token len:', rt.length, 'hash len:', rthash.length)
  console.log('hash deterministic:', await hashRefreshToken(rt) === rthash)

  console.log('--- done ---')
}

main().catch((e) => { console.error(e); process.exit(1) })
