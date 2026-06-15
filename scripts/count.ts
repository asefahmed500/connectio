import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const [users, clients, forms, submissions, teamMembers, files, comments, notifications] = await Promise.all([
    prisma.user.count(),
    prisma.client.count(),
    prisma.form.count(),
    prisma.submission.count(),
    prisma.teamMember.count(),
    prisma.file.count(),
    prisma.comment.count(),
    prisma.notification.count(),
  ])
  console.log(JSON.stringify({ users, clients, forms, submissions, teamMembers, files, comments, notifications }, null, 2))
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect())
