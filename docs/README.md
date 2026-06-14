# ClientConnect Portal — System Design

This folder is the **engineering spec** for ClientConnect Portal. It expands `prd.md` (the product spec) into an implementation-ready design that respects the actual codebase: Next.js 16 (App Router), Prisma + PostgreSQL, and JWT-in-HttpOnly-cookie auth.

`prd.md` describes the `pages/` directory and `pages/api/*` handlers — that routing model does **not** apply here. Where `prd.md` and these docs disagree, **these docs win**. (See `00-overview.md` for the divergence list.)

## Reading order

Read top to bottom the first time. After that, jump to the section you're working on.

| # | Doc | What it covers |
|---|-----|----------------|
| 00 | [Overview](./00-overview.md) | Stack, layered architecture, request flow, key decisions, PRD divergences |
| 01 | [Data Model](./01-data-model.md) | Prisma schema (full), ERD, enums, indexes, cascades, migration policy |
| 02 | [Authentication](./02-authentication.md) | Password hashing, JWT, HttpOnly cookies, login/register/logout/refresh, password reset |
| 03 | [RBAC & Data Isolation](./03-rbac-and-data-isolation.md) | Roles, permission matrix, Data Access Layer, multi-tenant isolation, IDOR prevention |
| 04 | [Invites & Registration](./04-invites-and-registration.md) | Slug lifecycle, one-time invite tokens, registration flow |
| 05 | [Forms & Submissions](./05-forms-and-submissions.md) | Dynamic form schema, submission state machine, validation |
| 06 | [Comments](./06-comments.md) | Threaded replies, internal vs external visibility, notification triggers |
| 07 | [Uploads](./07-uploads.md) | File validation, storage abstraction (local/S3), presigned URLs |
| 08 | [Routing & UI Layout](./08-routing-and-ui-layout.md) | App Router structure, route groups, layouts, error pages |
| 09 | [API Contracts](./09-api-contracts.md) | Route Handler contracts per resource, method tables, status codes |
| 10 | [Security](./10-security.md) | CSRF, rate limiting, CSP, secret management, OWASP concerns |
| 11 | [Error Handling & Observability](./11-error-handling-and-observability.md) | Typed errors, logging, audit log, error boundaries |
| 12 | [Environment & Config](./12-env-and-config.md) | Env var catalog, boot-time validation, secret rotation |
| 13 | [Deployment](./13-deployment.md) | Vercel + Neon, migrations, preview deploys, runtime concerns |
| 14 | [Notifications](./14-notifications.md) | In-app + real-time + email, role-based recipient routing, SSE transport |

## Conventions used across all docs

- **File paths** are repo-relative (e.g. `lib/dal/session.ts`). Path alias `@/*` maps to the repo root.
- **Code blocks** are illustrative — they show shape, not necessarily every import. Imports that matter for security (e.g. `import 'server-only'`, `'use server'`) are always shown.
- **Decision tables** record *why*, not just *what*. If a row reads "default from PRD", that's intentional.
- **Status badges**: each doc carries a `Status:` line at the top — `Draft`, `Approved`, `Implemented`. Treat `Draft` as open for discussion.

## How to use these docs

- **Starting a feature**: read the relevant doc end-to-end before writing code. The doc names files and types you're expected to use.
- **Disagreeing with a doc**: open a discussion *before* diverging in code. Docs-only drift is fixable; code-without-docs is a bug.
- **Updating a doc**: when implementation reveals a doc is wrong, update the doc in the same PR as the code.
