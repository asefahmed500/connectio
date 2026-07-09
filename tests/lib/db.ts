// Integration-test database helpers: isolation (truncate) + per-role data
// factories. Uses the same prisma singleton the DAL uses, so everything hits
// the same connectio_test database.

import { prisma } from '@/lib/db'
import type { UserRole, SubmissionStatus } from '@prisma/client'

let counter = 0
function uniq(prefix: string): string {
  counter += 1
  return `${prefix}-${Date.now().toString(36)}-${counter}-${Math.floor(Math.random() * 1e6).toString(36)}`
}

/** Wipe every table between tests so tests are independent. */
export async function truncateAll(): Promise<void> {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `
  const names = tables.map((t) => `"${t.tablename}"`).join(', ')
  if (names) {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${names} RESTART IDENTITY CASCADE;`)
  }
}

export async function makeUser(opts: {
  role: UserRole
  email?: string
  name?: string
  tokenVersion?: number
  password?: string
}): Promise<{ id: string; email: string; role: UserRole; tokenVersion: number; name: string }> {
  const email = opts.email ?? `${uniq('user')}@test.local`
  let passwordHash = 'argon2id$dummy-hash-not-valid-for-login'
  if (opts.password) {
    const { hashPassword } = await import('@/lib/auth/password')
    passwordHash = await hashPassword(opts.password)
  }
  const user = await prisma.user.create({
    data: {
      email,
      name: opts.name ?? 'Test User',
      role: opts.role,
      passwordHash,
      tokenVersion: opts.tokenVersion ?? 0,
    },
    select: { id: true, email: true, role: true, tokenVersion: true, name: true },
  })
  return user
}

/** A CLIENT-role user + their Client row. Returns both ids + the slug. */
export async function makeClient(opts: {
  companyName?: string
  contactName?: string
} = {}): Promise<{
  user: { id: string; role: UserRole; tokenVersion: number }
  client: { id: string; uniqueSlug: string }
}> {
  const user = await makeUser({ role: 'CLIENT' })
  const client = await prisma.client.create({
    data: {
      userId: user.id,
      companyName: opts.companyName ?? uniq('Acme'),
      contactName: opts.contactName ?? 'Client Contact',
      uniqueSlug: uniq('client'),
    },
    select: { id: true, uniqueSlug: true },
  })
  return {
    user: { id: user.id, role: user.role, tokenVersion: user.tokenVersion },
    client: { id: client.id, uniqueSlug: client.uniqueSlug },
  }
}

/** A TEAM_MEMBER user + their TeamMember row. */
export async function makeTeamMember(opts: {
  name?: string
} = {}): Promise<{
  user: { id: string; role: UserRole; tokenVersion: number }
  teamMember: { id: string }
}> {
  const user = await makeUser({ role: 'TEAM_MEMBER', name: opts.name })
  const teamMember = await prisma.teamMember.create({
    data: { userId: user.id, department: 'Engineering' },
    select: { id: true },
  })
  return { user: { id: user.id, role: user.role, tokenVersion: user.tokenVersion }, teamMember }
}

/** Assign a team member to a client. */
export async function assignTeam(teamMemberId: string, clientId: string): Promise<void> {
  await prisma.teamAssignment.create({ data: { teamMemberId, clientId } })
}

const SAMPLE_SCHEMA = {
  version: 1,
  fields: [
    { name: 'projectName', label: 'Project name', type: 'text', required: true },
    { name: 'budget', label: 'Budget', type: 'number' },
  ],
}

export async function makeForm(opts: {
  title?: string
  isActive?: boolean
  schema?: unknown
} = {}): Promise<{ id: string; title: string }> {
  const form = await prisma.form.create({
    data: {
      title: opts.title ?? uniq('Form'),
      description: 'test form',
      formSchema: (opts.schema ?? SAMPLE_SCHEMA) as object,
      isActive: opts.isActive ?? true,
    },
    select: { id: true, title: true },
  })
  return form
}

export async function makeSubmission(opts: {
  clientId: string
  formId: string
  status?: SubmissionStatus
  formData?: Record<string, unknown>
}): Promise<{ id: string; status: SubmissionStatus }> {
  const sub = await prisma.submission.create({
    data: {
      clientId: opts.clientId,
      formId: opts.formId,
      formData: (opts.formData ?? { projectName: 'P' }) as object,
      status: opts.status ?? 'DRAFT',
    },
    select: { id: true, status: true },
  })
  return sub
}

export { prisma }
