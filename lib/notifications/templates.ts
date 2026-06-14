import 'server-only'
import type { NotificationEvent } from './types'

// Pure functions: take an event, return pre-rendered strings. Pre-rendering
// freezes the message at event time so later renames don't break old
// notifications ("undefined mentioned you on undefined" defense).

type Template = {
  title: string
  body: string
  href: string
  emailByDefault: boolean
}

function clientHref(clientId: string, rest = ''): string {
  return `/admin/clients/${clientId}${rest}`
}

export function renderTemplate(
  event: NotificationEvent,
  context: { clientSlug?: string } = {},
): Template {
  switch (event.type) {
    case 'INVITE_CONSUMED':
      return {
        title: 'Invite accepted',
        body: `${event.companyName} accepted their invite and registered.`,
        href: clientHref(event.clientId),
        emailByDefault: true,
      }

    case 'SUBMISSION_SUBMITTED':
      return {
        title: 'New submission',
        body: `${event.formTitle} was submitted for review.`,
        href: clientHref(event.clientId),
        emailByDefault: true,
      }

    case 'SUBMISSION_IN_REVIEW':
      return {
        title: 'Review started',
        body: `Your ${event.formTitle} submission is being reviewed.`,
        href: clientSubmissionHref(context.clientSlug, event.submissionId),
        emailByDefault: false,
      }

    case 'SUBMISSION_CHANGES_REQUESTED':
      return {
        title: 'Changes requested',
        body: `Please revise your ${event.formTitle} submission.`,
        href: clientSubmissionHref(context.clientSlug, event.submissionId),
        emailByDefault: true,
      }

    case 'SUBMISSION_APPROVED':
      return {
        title: 'Submission approved',
        body: `Your ${event.formTitle} submission was approved.`,
        href: clientSubmissionHref(context.clientSlug, event.submissionId),
        emailByDefault: true,
      }

    case 'SUBMISSION_REJECTED':
      return {
        title: 'Submission rejected',
        body: `Your ${event.formTitle} submission was rejected.`,
        href: clientSubmissionHref(context.clientSlug, event.submissionId),
        emailByDefault: true,
      }

    case 'COMMENT_POSTED_EXTERNAL':
      return {
        title: 'New message',
        body: event.messagePreview,
        href: clientHref(event.clientId),
        emailByDefault: true,
      }

    case 'COMMENT_POSTED_EXTERNAL_BY_CLIENT':
      return {
        title: 'Client sent a message',
        body: event.messagePreview,
        href: clientHref(event.clientId),
        emailByDefault: true,
      }

    case 'COMMENT_POSTED_INTERNAL':
      return {
        title: 'New internal note',
        body: event.messagePreview,
        href: clientHref(event.clientId),
        // Internal never emails — would leak existence to whoever has mailbox access.
        emailByDefault: false,
      }

    case 'COMMENT_REPLY':
      return {
        title: 'Reply to your comment',
        body: event.messagePreview,
        href: clientHref(event.clientId),
        emailByDefault: true,
      }

    case 'FILE_UPLOADED_CLIENT':
      return {
        title: 'Client uploaded a file',
        body: event.fileName,
        href: clientHref(event.clientId),
        emailByDefault: false,
      }

    case 'FILE_UPLOADED_TEAM':
      return {
        title: 'New file from your team',
        body: event.fileName,
        href: context.clientSlug
          ? `/dashboard/visitor/${context.clientSlug}/files`
          : '/dashboard/visitor',
        emailByDefault: false,
      }

    case 'TEAM_MEMBER_ASSIGNED':
      return {
        title: 'New client assigned',
        body: `You're now assigned to ${event.companyName}.`,
        href: '/team',
        emailByDefault: false,
      }
  }
}

function clientSubmissionHref(slug: string | undefined, submissionId: string): string {
  if (!slug) return '/dashboard/visitor'
  return `/dashboard/visitor/${slug}/submissions/${submissionId}`
}
