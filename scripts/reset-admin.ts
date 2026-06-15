import { PrismaClient } from '@prisma/client'
import { hash } from '@node-rs/argon2'

async function main() {
  const prisma = new PrismaClient()
  try {
    const pw = process.env.SEED_ADMIN_PASSWORD ?? 'Admin-password-123'
    await prisma.user.update({
      where: { email: 'admin@localhost' },
      data: { passwordHash: await hash(pw, { algorithm: 2 as const, memoryCost: 19_456, timeCost: 2, parallelism: 1 }) },
    })
    console.log('Admin password reset to:', pw)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
