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
    case 'INVITE_CREATED':
      return {
        title: 'Invite created',
        body: `An invite link was generated for ${event.companyName} (${event.contactName}).`,
        href: '/admin/invites',
        emailByDefault: false,
      }

    case 'INVITE_CONSUMED':
      return {
        title: 'Invite accepted',
        body: `${event.companyName} accepted their invite and registered.`,
        href: clientHref(event.clientId),
        emailByDefault: true,
      }

    case 'INVITE_EXPIRED':
      return {
        title: 'Invite expired',
        body: `The invite for ${event.companyName} expired before being used.`,
        href: '/admin/invites',
        emailByDefault: false,
      }

    case 'SUBMISSION_DRAFTED':
      return {
        title: 'Draft saved',
        body: `Draft of ${event.formTitle} was saved.`,
        href: clientHref(event.clientId),
        emailByDefault: false,
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

    case 'USER_UPDATED':
      return {
        title: 'Account updated',
        body: 'Your account details have been updated by an administrator.',
        href: '/login',
        emailByDefault: false,
      }

    case 'USER_BLOCKED':
      return {
        title: 'Account blocked',
        body: 'Your account has been blocked. Contact your administrator for details.',
        href: '/login',
        emailByDefault: true,
      }

    case 'USER_UNBLOCKED':
      return {
        title: 'Account restored',
        body: 'Your account has been unblocked. You may now log in.',
        href: '/login',
        emailByDefault: true,
      }

    case 'USER_DELETED':
      return {
        title: 'Account removed',
        body: 'Your account has been removed by an administrator.',
        href: '/login',
        emailByDefault: false,
      }

    case 'USER_PASSWORD_RESET_BY_ADMIN':
      return {
        title: 'Password reset',
        body: 'Your password was reset by an administrator. Check your email for a new password.',
        href: '/login',
        emailByDefault: true,
      }

    case 'USER_CREATED':
      return {
        title: 'Account created',
        body: 'Your account has been created. Check your email for login details.',
        href: '/login',
        emailByDefault: true,
      }

    case 'DATA_EXPORT_REQUESTED':
      return {
        title: 'Data export requested',
        body: 'Your data export request has been received. You will be notified when it is ready.',
        href: '/login',
        emailByDefault: false,
      }

    case 'DATA_EXPORT_COMPLETED':
      return {
        title: 'Data export ready',
        body: 'Your data export is ready for download. Visit your account settings to download it.',
        href: '/login',
        emailByDefault: true,
      }

    case 'ERASURE_REQUESTED':
      return {
        title: 'Erasure request submitted',
        body: 'Your erasure request has been submitted and is pending review by an administrator.',
        href: '/login',
        emailByDefault: false,
      }

    case 'ERASURE_APPROVED':
      return {
        title: 'Erasure completed',
        body: 'Your personal data has been erased in accordance with your request.',
        href: '/login',
        emailByDefault: true,
      }

    case 'ERASURE_DENIED':
      return {
        title: 'Erasure request denied',
        body: 'Your erasure request was not approved. Contact support for details.',
        href: '/login',
        emailByDefault: true,
      }

    case 'AUDIT_CHAIN_BROKEN':
      return {
        title: 'Audit chain integrity alert',
        body: `${event.brokenCount} audit log entr${event.brokenCount === 1 ? 'y has' : 'ies have'} been tampered with. Immediate investigation required.`,
        href: '/admin/audit-log',
        emailByDefault: true,
      }

    case 'SYSTEM_ERROR':
      return {
        title: 'System error',
        body: event.component
          ? `[${event.component}] ${event.message}`
          : event.message,
        href: '/admin',
        emailByDefault: true,
      }

    case 'SSO_PROVIDER_CREATED':
      return {
        title: 'SSO provider added',
        body: `Identity provider "${event.providerName}" was configured.`,
        href: '/admin/sso',
        emailByDefault: false,
      }

    case 'SSO_PROVIDER_UPDATED':
      return {
        title: 'SSO provider updated',
        body: `Identity provider "${event.providerName}" configuration was changed.`,
        href: '/admin/sso',
        emailByDefault: false,
      }

    case 'SSO_PROVIDER_DELETED':
      return {
        title: 'SSO provider removed',
        body: `Identity provider "${event.providerName}" was deleted. Users linked to it will no longer be able to sign in via SSO.`,
        href: '/admin/sso',
        emailByDefault: true,
      }

    case 'SSO_LOGIN_SUCCESS':
      return {
        title: 'SSO sign-in',
        body: `Signed in via ${event.providerName}.`,
        href: '/login',
        emailByDefault: false,
      }

    case 'SSO_LOGIN_FAILED':
      return {
        title: 'SSO sign-in failed',
        body: `An attempt to sign in via ${event.providerName} failed: ${event.reason}`,
        href: '/admin/audit-log',
        emailByDefault: false,
      }

    case 'SCIM_USER_PROVISIONED':
      return {
        title: 'Account provisioned',
        body: `Your account was provisioned automatically by ${event.providerName} via SCIM.`,
        href: '/login',
        emailByDefault: true,
      }

    case 'SCIM_USER_DEPROVISIONED':
      return {
        title: 'Account deactivated',
        body: `Your account was deactivated by ${event.providerName} via SCIM. Contact your administrator if this is unexpected.`,
        href: '/login',
        emailByDefault: true,
      }

    case 'FORM_ASSIGNED':
      return {
        title: 'Form assigned to you',
        body: `"${event.formTitle}" has been assigned to you. Click to fill it out.`,
        href: event.clientSlug
          ? `/dashboard/visitor/${event.clientSlug}/submissions/new?formId=${event.formId}`
          : `/dashboard/visitor/submissions/new?formId=${event.formId}`,
        emailByDefault: true,
      }
  }
}

function clientSubmissionHref(slug: string | undefined, submissionId: string): string {
  if (!slug) return '/dashboard/visitor'
  return `/dashboard/visitor/${slug}/submissions/${submissionId}`
}
