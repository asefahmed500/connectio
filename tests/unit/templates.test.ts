import { describe, expect, it } from 'vitest'
import { renderTemplate } from '@/lib/notifications/templates'
import type { NotificationEvent } from '@/lib/notifications/types'

// Minimal-but-valid event payloads per type. Cast through NotificationEvent
// since the union’s required-per-variant fields are present for each case.
const events: Record<string, NotificationEvent> = {
  INVITE_CONSUMED: { type: 'INVITE_CONSUMED', actorId: 'a', clientId: 'c', companyName: 'Acme' } as NotificationEvent,
  SUBMISSION_SUBMITTED: { type: 'SUBMISSION_SUBMITTED', actorId: 'a', clientId: 'c', submissionId: 's', formTitle: 'Onboarding' } as NotificationEvent,
  SUBMISSION_IN_REVIEW: { type: 'SUBMISSION_IN_REVIEW', actorId: 'a', clientId: 'c', submissionId: 's', formTitle: 'Onboarding' } as NotificationEvent,
  SUBMISSION_CHANGES_REQUESTED: { type: 'SUBMISSION_CHANGES_REQUESTED', actorId: 'a', clientId: 'c', submissionId: 's', formTitle: 'Onboarding' } as NotificationEvent,
  SUBMISSION_APPROVED: { type: 'SUBMISSION_APPROVED', actorId: 'a', clientId: 'c', submissionId: 's', formTitle: 'Onboarding' } as NotificationEvent,
  SUBMISSION_REJECTED: { type: 'SUBMISSION_REJECTED', actorId: 'a', clientId: 'c', submissionId: 's', formTitle: 'Onboarding' } as NotificationEvent,
  COMMENT_POSTED_EXTERNAL: { type: 'COMMENT_POSTED_EXTERNAL', actorId: 'a', clientId: 'c', commentId: 'cm', messagePreview: 'hi' } as NotificationEvent,
  COMMENT_POSTED_EXTERNAL_BY_CLIENT: { type: 'COMMENT_POSTED_EXTERNAL_BY_CLIENT', actorId: 'a', clientId: 'c', commentId: 'cm', messagePreview: 'hi' } as NotificationEvent,
  COMMENT_POSTED_INTERNAL: { type: 'COMMENT_POSTED_INTERNAL', actorId: 'a', clientId: 'c', commentId: 'cm', messagePreview: 'internal' } as NotificationEvent,
  COMMENT_REPLY: { type: 'COMMENT_REPLY', actorId: 'a', clientId: 'c', commentId: 'cm', parentAuthorId: 'p', messagePreview: 'reply' } as NotificationEvent,
  FILE_UPLOADED_CLIENT: { type: 'FILE_UPLOADED_CLIENT', actorId: 'a', clientId: 'c', fileName: 'doc.pdf' } as NotificationEvent,
  FILE_UPLOADED_TEAM: { type: 'FILE_UPLOADED_TEAM', actorId: 'a', clientId: 'c', fileName: 'doc.pdf' } as NotificationEvent,
  TEAM_MEMBER_ASSIGNED: { type: 'TEAM_MEMBER_ASSIGNED', actorId: 'a', clientId: 'c', teamMemberUserId: 't', companyName: 'Acme' } as NotificationEvent,
}

describe('renderTemplate — every event type renders fully', () => {
  for (const [name, event] of Object.entries(events)) {
    it(`${name} returns a non-empty title/body/href`, () => {
      const tpl = renderTemplate(event, { clientSlug: 'acme' })
      expect(tpl.title.length).toBeGreaterThan(0)
      expect(tpl.body.length).toBeGreaterThan(0)
      expect(tpl.href.length).toBeGreaterThan(0)
      expect(typeof tpl.emailByDefault).toBe('boolean')
      // No accidental "undefined" leaking into rendered strings.
      expect(tpl.title).not.toContain('undefined')
      expect(tpl.body).not.toContain('undefined')
    })
  }
})

describe('renderTemplate — email policy', () => {
  it('does not email internal comments (could leak existence)', () => {
    expect(renderTemplate(events.COMMENT_POSTED_INTERNAL).emailByDefault).toBe(false)
  })

  it('does not email file-upload notifications by default', () => {
    expect(renderTemplate(events.FILE_UPLOADED_CLIENT).emailByDefault).toBe(false)
    expect(renderTemplate(events.FILE_UPLOADED_TEAM).emailByDefault).toBe(false)
  })

  it('emails client-facing review outcomes', () => {
    expect(renderTemplate(events.SUBMISSION_APPROVED).emailByDefault).toBe(true)
    expect(renderTemplate(events.SUBMISSION_REJECTED).emailByDefault).toBe(true)
    expect(renderTemplate(events.SUBMISSION_CHANGES_REQUESTED).emailByDefault).toBe(true)
  })

  it('falls back to a slug-less href when no clientSlug is provided', () => {
    const tpl = renderTemplate(events.SUBMISSION_APPROVED)
    expect(tpl.href).toBe('/dashboard/visitor')
  })
})
