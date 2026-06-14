# 01 — Data Model

**Status:** Draft
**Storage:** PostgreSQL 15+ via Prisma
**Naming:** `camelCase` fields, `PascalCase` models, `SCREAMING_SNAKE` enums. All PKs are `String @id @default(cuid())`.

This doc adapts the Prisma schema from `prd.md` to the actual stack: cuid IDs, `@@index` declarations on every foreign key + hot read path, `onDelete: Cascade` only where the child has no standalone meaning, and `onDelete: SetNull` for soft references like `Comment.submissionId`.

## Schema

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─────────────────────────────────────────────────────────────────
// Users & Auth
// ─────────────────────────────────────────────────────────────────

model User {
  id            String         @id @default(cuid())
  email         String         @unique
  passwordHash  String
  role          UserRole
  name          String

  // Optional 1:1 profile relations (filled in based on role)
  client        Client?
  teamMember    TeamMember?

  // Audit
  comments      Comment[]      @relation("CommentAuthor")
  auditLogs     AuditLog[]
  sessions      Session[]      // for revocation; see 02-authentication.md

  lastLoginAt   DateTime?
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt

  @@index([role])
}

enum UserRole {
  SUPER_ADMIN
  TEAM_MEMBER
  CLIENT
}

model Session {
  // Used for token revocation. Access tokens are stateless;
  // refresh tokens are looked up here on each /refresh.
  id            String   @id @default(cuid())
  userId        String
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  refreshTokenHash String @unique  // hash of the refresh token; never store raw
  expiresAt     DateTime
  revokedAt     DateTime?
  ip            String?
  userAgent     String?
  createdAt     DateTime @default(now())

  @@index([userId])
  @@index([expiresAt])
}

// ─────────────────────────────────────────────────────────────────
// Invites  (pre-registration; consumed at sign-up)
// ─────────────────────────────────────────────────────────────────

model Invite {
  id            String           @id @default(cuid())
  email         String
  companyName   String
  contactName   String
  slug          String           @unique  // becomes Client.uniqueSlug on registration
  createdBy     String           // admin user id
  status        InviteStatus     @default(OPEN)
  consumedBy    String?          // → User.id once registered
  expiresAt     DateTime         @default(now() + 7 days)  // expressed in app logic
  createdAt     DateTime         @default(now())

  @@index([status])
  @@index([email])
}

enum InviteStatus {
  OPEN          // link active, not yet used
  CONSUMED      // client registered
  REVOKED       // admin cancelled
  EXPIRED       // past expiresAt (set by cron or lazy on read)
}

// ─────────────────────────────────────────────────────────────────
// Clients & Team
// ─────────────────────────────────────────────────────────────────

model Client {
  id            String         @id @default(cuid())
  userId        String         @unique
  user          User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  inviteId      String?        @unique  // back-ref; null if migrated
  invite        Invite?        @relation(fields: [inviteId], references: [id], onDelete: SetNull)

  companyName   String
  contactName   String
  uniqueSlug    String         @unique

  // Free-form intake fields (also captured at invite time)
  projectBrief  String?
  budget        String?
  timeline      String?

  submissions   Submission[]
  comments      Comment[]
  files         File[]         // top-level uploads (e.g. briefs) not tied to a submission
  assignments   TeamAssignment[]

  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt

  @@index([uniqueSlug])
}

model TeamMember {
  id            String           @id @default(cuid())
  userId        String           @unique
  user          User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  department    String?
  assignments   TeamAssignment[]
  createdAt     DateTime         @default(now())
  updatedAt     DateTime         @updatedAt
}

model TeamAssignment {
  // Many-to-many between TeamMember and Client
  id            String     @id @default(cuid())
  teamMemberId  String
  teamMember    TeamMember @relation(fields: [teamMemberId], references: [id], onDelete: Cascade)
  clientId      String
  client        Client     @relation(fields: [clientId], references: [id], onDelete: Cascade)
  assignedAt    DateTime   @default(now())

  @@unique([teamMemberId, clientId])
  @@index([clientId])
}

// ─────────────────────────────────────────────────────────────────
// Forms & Submissions
// ─────────────────────────────────────────────────────────────────

model Form {
  id            String       @id @default(cuid())
  title         String
  description   String?
  formSchema    Json         // see 05-forms-and-submissions.md
  isActive      Boolean      @default(true)
  submissions   Submission[]
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt

  @@index([isActive])
}

enum SubmissionStatus {
  DRAFT
  SUBMITTED
  IN_REVIEW
  APPROVED
  REJECTED
  CHANGES_REQUESTED
}

model Submission {
  id          String           @id @default(cuid())
  clientId    String
  client      Client           @relation(fields: [clientId], references: [id], onDelete: Cascade)
  formId      String
  form        Form             @relation(fields: [formId], references: [id])
  formData    Json             // validated against form.formSchema at write time
  status      SubmissionStatus @default(DRAFT)

  files       File[]
  comments    Comment[]

  submittedAt DateTime?
  reviewedBy  String?           // → User.id
  reviewedAt  DateTime?

  createdAt   DateTime          @default(now())
  updatedAt   DateTime          @updatedAt

  // One submission per client per form. Re-submitting replaces the row
  // (handled in DAL) to keep this constraint strict.
  @@unique([clientId, formId])
  @@index([status])
  @@index([formId])
}

// ─────────────────────────────────────────────────────────────────
// Files
// ─────────────────────────────────────────────────────────────────

model File {
  id            String       @id @default(cuid())
  // A file belongs to either a Submission (most common) or a Client
  // directly (intake attachments like the original brief).
  submissionId  String?
  submission    Submission?  @relation(fields: [submissionId], references: [id], onDelete: Cascade)
  clientId      String
  client        Client       @relation(fields: [clientId], references: [id], onDelete: Cascade)

  storageKey    String       // e.g. "clients/<cuid>/submissions/<cuid>/<uuid>.pdf"
  originalName  String
  mimeType      String
  size          BigInt       // bytes; BigInt to support >2GB if ever needed
  checksum      String       // sha256, hex
  uploadedById  String
  uploadedBy    User         @relation(fields: [uploadedById], references: [id])

  uploadedAt    DateTime     @default(now())

  @@index([submissionId])
  @@index([clientId])
}

// ─────────────────────────────────────────────────────────────────
// Comments
// ─────────────────────────────────────────────────────────────────

model Comment {
  id            String      @id @default(cuid())
  clientId      String
  client        Client      @relation(fields: [clientId], references: [id], onDelete: Cascade)
  authorId      String
  author        User        @relation("CommentAuthor", fields: [authorId], references: [id])

  submissionId  String?
  submission    Submission? @relation(fields: [submissionId], references: [id], onDelete: SetNull)

  message       String
  isInternal    Boolean     @default(false)  // hidden from Client when true

  parentId      String?
  parent        Comment?    @relation("CommentReplies", fields: [parentId], references: [id], onDelete: Cascade)
  replies       Comment[]   @relation("CommentReplies")

  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt

  @@index([clientId, createdAt])
  @@index([submissionId])
  @@index([authorId])
}

// ─────────────────────────────────────────────────────────────────
// Audit Log  (append-only)
// ─────────────────────────────────────────────────────────────────

model AuditLog {
  id          String   @id @default(cuid())
  userId      String?
  user        User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
  action      String   // "CLIENT_VIEWED", "SUBMISSION_UPDATED", etc.
  resource    String   // "Client", "Submission", "Comment", ...
  resourceId  String
  changes     Json?    // before/after diff
  ip          String?
  userAgent   String?
  createdAt   DateTime @default(now())

  @@index([userId, createdAt])
  @@index([resource, resourceId])
  @@index([createdAt])
}
```

## ERD (text)

```
User ─┬─< Client ─┬─< Submission ─< File
      │           ├─< Comment
      │           ├─< File (client-level)
      │           └─< TeamAssignment >─ TeamMember ── User
      ├─< TeamMember
      ├─< Session
      └─< AuditLog

Invite ─1:0..1─ Client
Form ─< Submission ─< File
Comment ─< Comment (self-ref via parentId, "CommentReplies")
```

## Index rationale

- `User.email` is `@unique` (serves as the lookup index for login).
- `Client.uniqueSlug` is `@unique` (lookup at `/dashboard/visitor/[slug]`).
- Every FK used in a `where` clause also has an `@@index` — Prisma doesn't auto-index FKs on Postgres for the client side, and we don't want hot paths to seq-scan.
- `(clientId, createdAt)` compound index on `Comment` powers the "threaded feed ordered newest-first" query.
- `Submission @@unique([clientId, formId])` is the integrity guarantee for "one form, one submission per client".

## Cascade policy

| Relation | onDelete | Why |
|----------|----------|-----|
| `User → Client` | Cascade | A client row is meaningless without its auth user |
| `User → TeamMember` | Cascade | Same |
| `User → Session` | Cascade | Sessions must die with the user |
| `Client → Submission` | Cascade | Submissions belong to the client |
| `Client → Comment` | Cascade | Same |
| `Client → File` | Cascade | Storage cleanup handled in DAL before row delete |
| `Submission → File` | Cascade | Same |
| `Submission → Comment` | SetNull | Comments survive when a submission is deleted (audit trail) |
| `Comment → Comment` (parent) | Cascade | Deleting a thread removes replies |
| `Invite → Client` | SetNull | Keep client after invite is purged |

## Migration policy

- **Every schema change gets a migration**. No `db push` past local dev.
- Migrations are committed: `prisma/migrations/<timestamp>_<slug>/`.
- Naming: `npx prisma migrate dev --name <verb>_<entity>` (e.g. `add_submission_reviewedby`).
- **Never edit a shipped migration.** If you need to change it, add a new one.
- Destructive operations (drop column, rename) require a two-phase migration when data exists in prod:
  1. Phase 1: deploy code that writes to both old and new.
  2. Phase 2: deploy migration that drops old.
- See `13-deployment.md` for how migrations run on Vercel.

## Seed data

`prisma/seed.ts` (script: `prisma db seed`) creates:
- 1 Super Admin (from `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`)
- 2 sample Forms (Project Brief, Design Preferences)
- 2 sample Team Members
- 1 sample Client with a Submission and a Comment

Seed runs only against non-producton databases (asserted in the script).
