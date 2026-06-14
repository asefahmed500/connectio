import 'server-only'
import { hash, verify } from '@node-rs/argon2'

// Algorithm.Argon2id is a const enum (value 2 per RFC 9106) but `isolatedModules`
// disallows const-enum member access. Inline the value with a clear name.
const ARGON2ID = 2

const params = {
  algorithm: ARGON2ID,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
}

// A valid argon2id hash for a throwaway password. Used to keep verify()
// running for the full duration when no user was found, so login timing
// doesn't leak which emails have accounts. (REVIEW.md §2.1.)
const DUMMY_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$ZPMyUrct33vTxmNx1fS4hA$BbNPkW7FHP48dUee3HM/fxlvfTiVzaA3MEVID4nI4u8'

export async function hashPassword(password: string): Promise<string> {
  return hash(password, params)
}

export async function verifyPassword(
  storedHash: string | null,
  password: string,
): Promise<boolean> {
  // Always run a verify against a dummy hash so timing doesn't reveal whether
  // the user exists. Callers pass `null` when no user was found.
  try {
    return await verify(storedHash ?? DUMMY_HASH, password)
  } catch {
    return false
  }
}
