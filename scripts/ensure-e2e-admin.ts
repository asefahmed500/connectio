// Ensures an E2E admin exists with a UI-loginable email + known password.
// Non-destructive upsert (create-or-update) — does NOT drop the database.
//
// Why a separate email: the default seed admin is `admin@localhost`, but Zod's
// `z.email()` rejects domains without a dot, so that account can't sign in via
// the login form. E2E needs a real, loginable admin.
//
// Run with: npx tsx scripts/ensure-e2e-admin.ts

import { PrismaClient, UserRole } from '@prisma/client'
import { hash } from '@node-rs/argon2'

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to create an E2E admin in production.')
  }
  const prisma = new PrismaClient()
  try {
    const email = process.env.E2E_ADMIN_EMAIL ?? 'e2e-admin@example.com'
    const password = process.env.E2E_ADMIN_PASSWORD ?? 'E2eAdmin!2026'
    const passwordHash = await hash(password, {
      algorithm: 2 as const,
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1,
    })
    await prisma.user.upsert({
      where: { email },
      update: { passwordHash, role: UserRole.SUPER_ADMIN },
      create: { email, name: 'E2E Admin', role: UserRole.SUPER_ADMIN, passwordHash },
    })
    console.log('E2E admin ready:', email)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
