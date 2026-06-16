// Test data seed — creates a full set of users (admin, team, clients),
// invites, forms, submissions (one per state), files, comments, and
// notifications so we can exercise every UI flow via next-browser.
//
// Idempotent: reruns are safe. Wipes test rows first if WIPE_TEST_DATA=1.
//
// Run with: npx tsx scripts/seed-test-data.ts
//
// Passwords are deterministic so we can log in via next-browser:
//   admin@clientconnect.com / Admin123!    (already created by prisma/seed.ts)
//   team@clientconnect.com  / Team123!
//   alice@acme.com          / Client123!
//   bob@globex.com          / Client123!
//   carol@initech.com       / Client123!

import { PrismaClient, UserRole, SubmissionStatus, InviteStatus } from '@prisma/client'
import { hash } from '@node-rs/argon2'

const ARGON2ID = 2

const TEST_PASSWORDS = {
  admin: 'Admin123!',
  team: 'Team123!',
  client: 'Client123!',
}

const argon = (pw: string) =>
  hash(pw, { algorithm: ARGON2ID, memoryCost: 19_456, timeCost: 2, parallelism: 1 })

const prisma = new PrismaClient()

async function upsertUser(email: string, name: string, role: UserRole, pw: string) {
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return existing
  }
  return prisma.user.create({
    data: {
      email,
      name,
      role,
      passwordHash: await argon(pw),
    },
  })
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed test data in production.')
  }

  // ── Wipe (optional) ─────────────────────────────────────────────
  if (process.env.WIPE_TEST_DATA === '1') {
    console.log('Wiping test data...')
    await prisma.notification.deleteMany()
    await prisma.comment.deleteMany()
    await prisma.file.deleteMany()
    await prisma.submission.deleteMany()
    await prisma.teamAssignment.deleteMany()
    await prisma.teamMember.deleteMany()
    await prisma.client.deleteMany()
    await prisma.invite.deleteMany({ where: { status: { in: [InviteStatus.OPEN, InviteStatus.CONSUMED] } } })
    await prisma.auditLog.deleteMany()
    await prisma.user.deleteMany({ where: { role: { not: UserRole.SUPER_ADMIN } } })
    console.log('Wiped.')
  }

  // ── Users ──────────────────────────────────────────────────────
  const admin = await upsertUser('admin@clientconnect.com', 'Super Admin', UserRole.SUPER_ADMIN, TEST_PASSWORDS.admin)
  const team = await upsertUser('team@clientconnect.com', 'Team Member', UserRole.TEAM_MEMBER, TEST_PASSWORDS.team)
  const team2 = await upsertUser('team2@clientconnect.com', 'Team Member 2', UserRole.TEAM_MEMBER, TEST_PASSWORDS.team)

  // ── TeamMember profiles ────────────────────────────────────────
  const teamProfile =
    (await prisma.teamMember.findUnique({ where: { userId: team.id } })) ??
    (await prisma.teamMember.create({ data: { userId: team.id, department: 'Engineering' } }))
  const team2Profile =
    (await prisma.teamMember.findUnique({ where: { userId: team2.id } })) ??
    (await prisma.teamMember.create({ data: { userId: team2.id, department: 'Design' } }))

  // ── Invites + Clients ──────────────────────────────────────────
  const clientSpecs = [
    { slug: 'acme', email: 'alice@acme.com', company: 'Acme Corp', contact: 'Alice Adams' },
    { slug: 'globex', email: 'bob@globex.com', company: 'Globex Inc', contact: 'Bob Brown' },
    { slug: 'initech', email: 'carol@initech.com', company: 'Initech LLC', contact: 'Carol Chen' },
  ]

  const clients: Array<{ id: string; uniqueSlug: string; companyName: string; contactName: string; userId: string }> = []
  for (const spec of clientSpecs) {
    const user = await upsertUser(spec.email, spec.contact, UserRole.CLIENT, TEST_PASSWORDS.client)
    const client = await prisma.client.upsert({
      where: { uniqueSlug: spec.slug },
      update: {},
      create: {
        userId: user.id,
        companyName: spec.company,
        contactName: spec.contact,
        uniqueSlug: spec.slug,
        projectBrief: `Initial project for ${spec.company}.`,
        budget: '$50,000 – $80,000',
        timeline: 'Q3 2026',
      },
    })
    clients.push({
      id: client.id,
      uniqueSlug: client.uniqueSlug,
      companyName: client.companyName,
      contactName: client.contactName,
      userId: user.id,
    })

    // Assign team members to the client (composite unique)
    for (const t of [teamProfile, team2Profile]) {
      await prisma.teamAssignment.upsert({
        where: { teamMemberId_clientId: { teamMemberId: t.id, clientId: client.id } },
        update: {},
        create: { teamMemberId: t.id, clientId: client.id },
      })
    }
  }

  // ── Forms ──────────────────────────────────────────────────────
  const formSpecs = [
    {
      title: 'Client Onboarding',
      description: 'Initial intake form for new clients.',
      formSchema: {
        version: 1,
        fields: [
          { name: 'company_name', label: 'Company name', type: 'text', required: true },
          { name: 'contact_email', label: 'Primary contact email', type: 'email', required: true },
          { name: 'website', label: 'Website', type: 'url', required: false },
          { name: 'description', label: 'Describe your business', type: 'textarea', required: true },
          { name: 'employees', label: 'Number of employees', type: 'number', required: false },
          { name: 'industry', label: 'Industry', type: 'select', required: true, options: [
            { label: 'Tech', value: 'tech' },
            { label: 'Finance', value: 'finance' },
            { label: 'Healthcare', value: 'healthcare' },
            { label: 'Other', value: 'other' },
          ]},
        ],
      },
    },
    {
      title: 'Project Brief',
      description: 'Define the scope of work.',
      formSchema: {
        version: 1,
        fields: [
          { name: 'title', label: 'Project title', type: 'text', required: true },
          { name: 'goals', label: 'Project goals', type: 'textarea', required: true },
          { name: 'deadline', label: 'Target deadline', type: 'text' },
          { name: 'budget', label: 'Budget range', type: 'text' },
        ],
      },
    },
    {
      title: 'Feedback Survey',
      description: 'Tell us how it went.',
      formSchema: {
        version: 1,
        fields: [
          { name: 'rating', label: 'Overall rating', type: 'select', required: true, options: [
            { label: '1', value: '1' },
            { label: '2', value: '2' },
            { label: '3', value: '3' },
            { label: '4', value: '4' },
            { label: '5', value: '5' },
          ]},
          { name: 'comments', label: 'Comments', type: 'textarea' },
        ],
      },
    },
  ]

  const formKeys = ['onboarding', 'project_brief', 'feedback']
  const forms: Array<{ id: string; title: string; key: string }> = []
  for (const [i, spec] of formSpecs.entries()) {
    const form = await prisma.form.create({ data: spec })
    forms.push({ id: form.id, title: form.title, key: formKeys[i] })
  }

  // ── Submissions (one per state machine state) ───────────────────
  // Form 0 → Acme: SUBMITTED
  // Form 0 → Globex: IN_REVIEW
  // Form 1 → Acme: DRAFT
  // Form 1 → Globex: APPROVED
  // Form 2 → Initech: CHANGES_REQUESTED
  // Form 2 → Acme: REJECTED

  const submissionSpecs: Array<{
    clientSlug: string
    formKey: string
    status: SubmissionStatus
    data: Record<string, unknown>
  }> = [
    { clientSlug: 'acme', formKey: 'onboarding', status: SubmissionStatus.SUBMITTED, data: { company_name: 'Acme Corp', contact_email: 'alice@acme.com', description: 'Sells anvils.', employees: 12 } },
    { clientSlug: 'globex', formKey: 'onboarding', status: SubmissionStatus.IN_REVIEW, data: { company_name: 'Globex Inc', contact_email: 'bob@globex.com', description: 'World domination.' } },
    { clientSlug: 'acme', formKey: 'project_brief', status: SubmissionStatus.DRAFT, data: { title: 'Acme website redesign', goals: 'Modernize the marketing site.' } },
    { clientSlug: 'globex', formKey: 'project_brief', status: SubmissionStatus.APPROVED, data: { title: 'Globex mobile app', goals: 'Launch MVP.', budget: '$60k' } },
    { clientSlug: 'initech', formKey: 'feedback', status: SubmissionStatus.CHANGES_REQUESTED, data: { rating: '3', comments: 'Decent.' } },
    { clientSlug: 'acme', formKey: 'feedback', status: SubmissionStatus.REJECTED, data: { rating: '2', comments: 'Not great.' } },
  ]

  for (const spec of submissionSpecs) {
    const client = clients.find((c) => c.uniqueSlug === spec.clientSlug)!
    const form = forms.find((f) => f.key === spec.formKey)!
    // @@unique([clientId, formId]) — delete any existing then recreate
    const existing = await prisma.submission.findUnique({
      where: { clientId_formId: { clientId: client.id, formId: form.id } },
    })
    if (existing) {
      // Update status if needed
      if (existing.status !== spec.status) {
        await prisma.submission.update({ where: { id: existing.id }, data: { status: spec.status } })
      }
      continue
    }
    await prisma.submission.create({
      data: {
        clientId: client.id,
        formId: form.id,
        formData: spec.data as object,
        status: spec.status,
        submittedAt: spec.status !== SubmissionStatus.DRAFT ? new Date() : null,
        reviewedBy: (
          [
            SubmissionStatus.APPROVED,
            SubmissionStatus.REJECTED,
            SubmissionStatus.CHANGES_REQUESTED,
            SubmissionStatus.IN_REVIEW,
          ] as SubmissionStatus[]
        ).includes(spec.status)
          ? admin.id
          : null,
        reviewedAt: (
          [SubmissionStatus.APPROVED, SubmissionStatus.REJECTED, SubmissionStatus.CHANGES_REQUESTED] as SubmissionStatus[]
        ).includes(spec.status)
          ? new Date()
          : null,
      },
    })
  }

  // ── Files (one uploaded by admin against Acme) ──────────────────
  const acme = clients.find((c) => c.uniqueSlug === 'acme')!
  const existingFile = await prisma.file.findFirst({ where: { clientId: acme.id, storageKey: 'test-seed/test-document.txt' } })
  if (!existingFile) {
    await prisma.file.create({
      data: {
        clientId: acme.id,
        storageKey: 'test-seed/test-document.txt',
        originalName: 'welcome.txt',
        mimeType: 'text/plain',
        size: BigInt(64),
        checksum: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
        uploadedById: admin.id,
      },
    })
  }

  // ── Comments (external + internal on Acme) ──────────────────────
  const acmeUser = await prisma.user.findUniqueOrThrow({ where: { id: acme.userId } })
  const existingComment = await prisma.comment.findFirst({ where: { clientId: acme.id, message: 'Welcome to your portal!' } })
  if (!existingComment) {
    const c1 = await prisma.comment.create({
      data: { clientId: acme.id, authorId: admin.id, message: 'Welcome to your portal!', isInternal: false },
    })
    await prisma.comment.create({
      data: { clientId: acme.id, authorId: acmeUser.id, parentId: c1.id, message: 'Thanks!', isInternal: false },
    })
    await prisma.comment.create({
      data: { clientId: acme.id, authorId: team.id, message: 'Internal note: review checklist attached.', isInternal: true },
    })
  }

  // ── Notifications (sample) ──────────────────────────────────────
  const notifTypes = [
    { type: 'SUBMISSION_SUBMITTED' as const, title: 'New submission', body: 'Acme Corp submitted onboarding.' },
    { type: 'COMMENT_POSTED_EXTERNAL' as const, title: 'New comment', body: 'Alice Adams commented.' },
    { type: 'FILE_UPLOADED_CLIENT' as const, title: 'File uploaded', body: 'Acme Corp uploaded welcome.txt.' },
  ]
  for (const n of notifTypes) {
    const exists = await prisma.notification.findFirst({ where: { recipientId: admin.id, type: n.type, title: n.title } })
    if (!exists) {
      await prisma.notification.create({
        data: {
          recipientId: admin.id,
          type: n.type,
          title: n.title,
          body: n.body,
          href: '/admin',
          clientId: acme.id,
        },
      })
    }
  }

  // ── Bump admin unread count to match ────────────────────────────
  const unread = await prisma.notification.count({ where: { recipientId: admin.id, readAt: null } })
  await prisma.user.update({ where: { id: admin.id }, data: { unreadNotifications: unread } })

  console.log('Test data seed complete:')
  console.log(JSON.stringify({
    admin: admin.email,
    team: team.email,
    team2: team2.email,
    clients: clients.map((c) => ({ slug: c.uniqueSlug, company: c.companyName })),
    forms: forms.map((f) => f.key),
    counts: {
      submissions: await prisma.submission.count(),
      files: await prisma.file.count(),
      comments: await prisma.comment.count(),
      notifications: await prisma.notification.count(),
      teamAssignments: await prisma.teamAssignment.count(),
    },
  }, null, 2))
  console.log('\nLogin credentials:')
  console.log(`  admin@clientconnect.com / ${TEST_PASSWORDS.admin}`)
  console.log(`  team@clientconnect.com  / ${TEST_PASSWORDS.team}`)
  console.log(`  alice@acme.com          / ${TEST_PASSWORDS.client}`)
  console.log(`  bob@globex.com          / ${TEST_PASSWORDS.client}`)
  console.log(`  carol@initech.com       / ${TEST_PASSWORDS.client}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
