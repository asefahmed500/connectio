import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { truncateAll, makeUser } from '../lib/db'
import { signInAs, signOut } from '../lib/mock-headers'
import { prisma } from '@/lib/db'
import {
  listEmailTemplates,
  renderStoredTemplate,
  upsertEmailTemplate,
  deleteEmailTemplate,
} from '@/lib/dal/email-templates'

describe('renderStoredTemplate (no DB template → fallback)', () => {
  it('returns the fallback when no template exists', async () => {
    const result = await renderStoredTemplate(
      'nonexistent',
      { name: 'Alice' },
      { subject: 'Fallback', text: 'Hello Alice' },
    )
    expect(result.subject).toBe('Fallback')
    expect(result.text).toBe('Hello Alice')
  })

  it('returns the fallback when template exists but is inactive', async () => {
    // Need SUPER_ADMIN to create the inactive template
    const admin = await makeUser({ role: 'SUPER_ADMIN' })
    await signInAs(admin)

    await upsertEmailTemplate({
      key: 'inactive-test',
      name: 'Inactive',
      subject: 'Custom {{name}}',
      textBody: 'Hey {{name}}',
      isActive: false,
    })

    await signOut()

    const result = await renderStoredTemplate(
      'inactive-test',
      { name: 'Bob' },
      { subject: 'Fallback subj', text: 'Fallback text' },
    )
    expect(result.subject).toBe('Fallback subj')
    expect(result.text).toBe('Fallback text')

    // Clean up
    await signInAs(admin)
    const tpls = await listEmailTemplates()
    for (const t of tpls) {
      if (t.key === 'inactive-test') await deleteEmailTemplate(t.id)
    }
  })
})

describe('renderStoredTemplate (with DB template)', () => {
  it('substitutes {{var}} placeholders', async () => {
    const admin = await makeUser({ role: 'SUPER_ADMIN' })
    await signInAs(admin)

    await upsertEmailTemplate({
      key: 'sub-test',
      name: 'Substitution test',
      subject: 'Hello {{name}}',
      textBody: 'Welcome {{name}}! Visit: {{link}}',
    })

    await signOut()

    const result = await renderStoredTemplate(
      'sub-test',
      { name: 'Charlie', link: 'https://example.com' },
      { subject: 'default', text: 'default' },
    )
    expect(result.subject).toBe('Hello Charlie')
    expect(result.text).toBe('Welcome Charlie! Visit: https://example.com')

    await signInAs(admin)
    const tpls = await listEmailTemplates()
    for (const t of tpls) {
      if (t.key === 'sub-test') await deleteEmailTemplate(t.id)
    }
  })

  it('unknown variables become empty strings', async () => {
    const admin = await makeUser({ role: 'SUPER_ADMIN' })
    await signInAs(admin)

    await upsertEmailTemplate({
      key: 'missing-var',
      name: 'Missing var',
      subject: '{{greeting}}',
      textBody: '{{body}}',
    })

    await signOut()

    const result = await renderStoredTemplate(
      'missing-var',
      {},
      { subject: 'default', text: 'default' },
    )
    expect(result.subject).toBe('')
    expect(result.text).toBe('')
  })
})
