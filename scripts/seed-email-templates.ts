// Seeds the four default transactional email templates so the admin can
// edit them from the UI. Run with: npx tsx scripts/seed-email-templates.ts

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const TEMPLATES: Array<{
  key: string
  name: string
  category: string
  subject: string
  textBody: string
  htmlBody: string | null
  variables: string
}> = [
  {
    key: 'welcome',
    name: 'Welcome email',
    category: 'onboarding',
    subject: 'Welcome to ClientConnect — {{companyName}} account created',
    textBody:
      'Hello {{contactName}},\n\nYour {{companyName}} account on ClientConnect has been created.\n\nLogin credentials:\n  URL: {{loginUrl}}\n  Email: {{email}}\n  Password: {{password}}\n\nFor security, please change your password after logging in.\n\nBest regards,\nThe ClientConnect Team',
    htmlBody: null,
    variables: 'contactName, companyName, email, password, loginUrl',
  },
  {
    key: 'invite',
    name: 'Invitation email',
    category: 'onboarding',
    subject: "You're invited to ClientConnect — {{companyName}}",
    textBody:
      'Hello {{contactName}},\n\nYou\'ve been invited to join {{companyName}} on ClientConnect.\n\nSet up your account: {{inviteUrl}}\n\nThis link expires in 7 days.\n\nBest regards,\nThe ClientConnect Team',
    htmlBody: null,
    variables: 'contactName, companyName, inviteUrl',
  },
  {
    key: 'password_reset',
    name: 'Password reset email',
    category: 'security',
    subject: 'Reset your ClientConnect password',
    textBody:
      'Click this link to reset your password:\n\n{{resetUrl}}\n\nThis link expires in 1 hour. If you didn\'t request this, ignore this email.',
    htmlBody: null,
    variables: 'resetUrl',
  },
  {
    key: 'notification',
    name: 'Notification email',
    category: 'notifications',
    subject: '[ClientConnect] {{title}}',
    textBody: '{{body}}\n\nView: {{appUrl}}{{href}}',
    htmlBody: null,
    variables: 'title, body, href, appUrl',
  },
]

async function main() {
  for (const t of TEMPLATES) {
    await prisma.emailTemplate.upsert({
      where: { key: t.key },
      create: t,
      update: {
        name: t.name,
        category: t.category,
        subject: t.subject,
        textBody: t.textBody,
        htmlBody: t.htmlBody,
        variables: t.variables,
      },
    })
    console.log(`Seeded template: ${t.key}`)
  }
  console.log('Done.')
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
