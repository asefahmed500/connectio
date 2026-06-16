// Integration tests for lib/dal/submissions — the draft/submit/review workflow
// and the submission state machine, exercised against connectio_test.

import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { signInAs, signOut } from '../lib/mock-headers'
import { truncateAll, makeClient, makeTeamMember, makeForm, assignTeam } from '../lib/db'
import { prisma } from '@/lib/db'
import {
  getOrCreateDraft,
  saveDraft,
  submit,
  updateStatus,
  listSubmissionsForClient,
} from '@/lib/dal/submissions'

beforeEach(async () => {
  await truncateAll()
})
afterEach(() => signOut())

describe('draft lifecycle', () => {
  it('creates a draft on first touch and reuses it on the second', async () => {
    const c = await makeClient()
    const form = await makeForm()
    await signInAs(c.user)

    const first = await getOrCreateDraft({ clientId: c.client.id, formId: form.id })
    const second = await getOrCreateDraft({ clientId: c.client.id, formId: form.id })
    expect(first.status).toBe('DRAFT')
    expect(second.id).toBe(first.id) // @@unique([clientId, formId]) keeps it one row
  })

  it('saveDraft persists form data without changing status', async () => {
    const c = await makeClient()
    const form = await makeForm()
    await signInAs(c.user)
    const draft = await getOrCreateDraft({ clientId: c.client.id, formId: form.id })

    await saveDraft({ clientId: c.client.id, formId: form.id, formData: { projectName: 'Alpha' } })

    const row = await prisma.submission.findUnique({ where: { id: draft.id } })
    expect((row?.formData as { projectName?: string }).projectName).toBe('Alpha')
    expect(row?.status).toBe('DRAFT')
  })
})

describe('submit + state machine', () => {
  it('moves DRAFT → SUBMITTED', async () => {
    const c = await makeClient()
    const form = await makeForm()
    await signInAs(c.user)
    await getOrCreateDraft({ clientId: c.client.id, formId: form.id })

    const submitted = await submit({
      clientId: c.client.id,
      formId: form.id,
      formData: { projectName: 'Alpha' },
    })
    expect(submitted.status).toBe('SUBMITTED')
    expect(submitted.submittedAt).not.toBeNull()
  })

  it('rejects a re-submit from a non-transitionable status (SUBMITTED)', async () => {
    const c = await makeClient()
    const form = await makeForm()
    await signInAs(c.user)
    await submit({ clientId: c.client.id, formId: form.id, formData: { projectName: 'A' } })

    await expect(
      submit({ clientId: c.client.id, formId: form.id, formData: { projectName: 'B' } }),
    ).rejects.toThrow(/Cannot submit from status/)
  })

  it('an assigned TEAM_MEMBER can advance SUBMITTED → IN_REVIEW → APPROVED', async () => {
    const c = await makeClient()
    const tm = await makeTeamMember()
    await assignTeam(tm.teamMember.id, c.client.id)
    const form = await makeForm()

    await signInAs(c.user)
    const sub = await submit({ clientId: c.client.id, formId: form.id, formData: {} })

    await signInAs(tm.user)
    await updateStatus({ submissionId: sub.id, next: 'IN_REVIEW' })
    await updateStatus({ submissionId: sub.id, next: 'APPROVED' })

    const row = await prisma.submission.findUnique({ where: { id: sub.id } })
    expect(row?.status).toBe('APPROVED')
    expect(row?.reviewedBy).toBe(tm.user.id)
    expect(row?.reviewedAt).not.toBeNull()
  })

  it('rejects an invalid transition (APPROVED → SUBMITTED)', async () => {
    const c = await makeClient()
    const tm = await makeTeamMember()
    await assignTeam(tm.teamMember.id, c.client.id)
    const form = await makeForm()
    await signInAs(c.user)
    const sub = await submit({ clientId: c.client.id, formId: form.id, formData: {} })

    await signInAs(tm.user)
    await updateStatus({ submissionId: sub.id, next: 'IN_REVIEW' })
    await updateStatus({ submissionId: sub.id, next: 'APPROVED' })
    await expect(updateStatus({ submissionId: sub.id, next: 'SUBMITTED' })).rejects.toThrow(
      /Invalid transition/,
    )
  })

  it('blocks an unassigned TEAM_MEMBER from reviewing', async () => {
    const c = await makeClient()
    const tm = await makeTeamMember() // NOT assigned
    const form = await makeForm()
    await signInAs(c.user)
    const sub = await submit({ clientId: c.client.id, formId: form.id, formData: {} })

    await signInAs(tm.user)
    await expect(updateStatus({ submissionId: sub.id, next: 'IN_REVIEW' })).rejects.toThrow()
  })
})

describe('listSubmissionsForClient', () => {
  it('returns only the client’s submissions', async () => {
    const a = await makeClient()
    const b = await makeClient()
    const form = await makeForm()
    await signInAs(a.user)
    await submit({ clientId: a.client.id, formId: form.id, formData: {} })
    await signInAs(b.user)
    await submit({ clientId: b.client.id, formId: form.id, formData: {} })

    await signInAs(a.user)
    const res = await listSubmissionsForClient(a.client.id)
    expect(res.items).toHaveLength(1)
    expect(res.total).toBe(1)
  })
})
