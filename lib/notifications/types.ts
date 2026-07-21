// Discriminated union of every notification event. The audience rules in
// audience.ts switch on `event.type`; adding a new event means updating:
//   1. NotificationType enum in prisma/schema.prisma
//   2. This union
//   3. audience.ts computeRecipients
//   4. templates.ts renderTemplate

import type { UserRole, NotificationType } from '@prisma/client'

export type { NotificationType, UserRole }

export type NotificationEvent =
  | { type: 'INVITE_CREATED'; actorId: string; clientId: string | null; inviteId: string; companyName: string; contactName: string }
  | { type: 'INVITE_CONSUMED'; actorId: string; clientId: string; inviteCreatedBy: string; companyName: string }
  | { type: 'INVITE_EXPIRED'; actorId: string; inviteCreatedBy: string; companyName: string }
  | { type: 'SUBMISSION_DRAFTED'; actorId: string; clientId: string; submissionId: string; formTitle: string }
  | { type: 'SUBMISSION_SUBMITTED'; actorId: string; clientId: string; submissionId: string; formTitle: string }
  | { type: 'SUBMISSION_IN_REVIEW'; actorId: string; clientId: string; submissionId: string; formTitle: string }
  | { type: 'SUBMISSION_CHANGES_REQUESTED'; actorId: string; clientId: string; submissionId: string; formTitle: string }
  | { type: 'SUBMISSION_APPROVED'; actorId: string; clientId: string; submissionId: string; formTitle: string }
  | { type: 'SUBMISSION_REJECTED'; actorId: string; clientId: string; submissionId: string; formTitle: string }
  | { type: 'COMMENT_POSTED_EXTERNAL'; actorId: string; clientId: string; commentId: string; submissionId?: string; messagePreview: string }
  | { type: 'COMMENT_POSTED_EXTERNAL_BY_CLIENT'; actorId: string; clientId: string; commentId: string; submissionId?: string; messagePreview: string }
  | { type: 'COMMENT_POSTED_INTERNAL'; actorId: string; clientId: string; commentId: string; submissionId?: string; messagePreview: string }
  | { type: 'COMMENT_REPLY'; actorId: string; clientId: string; commentId: string; parentAuthorId: string; messagePreview: string }
  | { type: 'FILE_UPLOADED_CLIENT'; actorId: string; clientId: string; fileName: string }
  | { type: 'FILE_UPLOADED_TEAM'; actorId: string; clientId: string; fileName: string }
  | { type: 'TEAM_MEMBER_ASSIGNED'; actorId: string; clientId: string; teamMemberUserId: string; companyName: string }
  | { type: 'USER_UPDATED'; actorId: string; targetUserId: string }
  | { type: 'USER_BLOCKED'; actorId: string; targetUserId: string }
  | { type: 'USER_UNBLOCKED'; actorId: string; targetUserId: string }
  | { type: 'USER_DELETED'; actorId: string; targetUserId: string }
  | { type: 'USER_PASSWORD_RESET_BY_ADMIN'; actorId: string; targetUserId: string }
  | { type: 'USER_CREATED'; actorId: string; targetUserId: string }
  | { type: 'DATA_EXPORT_REQUESTED'; actorId: string; targetUserId: string }
  | { type: 'DATA_EXPORT_COMPLETED'; actorId: string; targetUserId: string }
  | { type: 'ERASURE_REQUESTED'; actorId: string; targetUserId: string }
  | { type: 'ERASURE_APPROVED'; actorId: string; targetUserId: string }
  | { type: 'ERASURE_DENIED'; actorId: string; targetUserId: string }
  | { type: 'AUDIT_CHAIN_BROKEN'; actorId: string; adminId: string; brokenCount: number }
  | { type: 'SYSTEM_ERROR'; actorId: string; message: string; component?: string }
  | { type: 'SSO_PROVIDER_CREATED'; actorId: string; providerId: string; providerName: string }
  | { type: 'SSO_PROVIDER_UPDATED'; actorId: string; providerId: string; providerName: string }
  | { type: 'SSO_PROVIDER_DELETED'; actorId: string; providerName: string }
  | { type: 'SSO_LOGIN_SUCCESS'; actorId: string; userId: string; providerName: string }
  | { type: 'SSO_LOGIN_FAILED'; actorId: string; providerName: string; reason: string }
  | { type: 'SCIM_USER_PROVISIONED'; actorId: string; targetUserId: string; providerName: string }
  | { type: 'SCIM_USER_DEPROVISIONED'; actorId: string; targetUserId: string; providerName: string }
  | { type: 'FORM_ASSIGNED'; actorId: string; targetUserId: string; formId: string; formTitle: string; clientSlug?: string }

export type NotificationDTO = {
  id: string
  type: NotificationType
  title: string
  body: string
  href: string
  readAt: string | null
  createdAt: string
}
