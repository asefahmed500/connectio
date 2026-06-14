// Database seed. Run with: npm run db:seed
//
// Refuses to run against NODE_ENV=production (asserted below).
// Creates one SUPER_ADMIN and prints credentials. Idempotent on email — re-running
// won't duplicate the admin or change the password if one already exists.

import { PrismaClient, UserRole } from '@prisma/client'
import { hash } from '@node-rs/argon2'

const ARGON2ID = 2

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed in production.')
  }

  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@localhost'
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'admin-password-123'
  const name = process.env.SEED_ADMIN_NAME ?? 'Super Admin'

  const prisma = new PrismaClient()
  try {
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      console.log(`Admin already exists: ${email} (skipping)`)
      return
    }

    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash: await hash(password, {
          algorithm: ARGON2ID,
          memoryCost: 19_456,
          timeCost: 2,
          parallelism: 1,
        }),
        role: UserRole.SUPER_ADMIN,
      },
      select: { id: true, email: true, role: true },
    })

    console.log('--- Admin created ---')
    console.log(`  id:    ${user.id}`)
    console.log(`  email: ${user.email}`)
    console.log(`  role:  ${user.role}`)
    console.log('  Login at /login with the email + SEED_ADMIN_PASSWORD above.')
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
