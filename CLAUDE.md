# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

- `npm run dev` — start the Next.js dev server (http://localhost:3000)
- `npm run build` — production build
- `npm run start` — serve the production build
- `npm run lint` — ESLint (flat config, `eslint-config-next` core-web-vitals + typescript)

No test runner is configured. There is no single-test command to run.

## Project status — greenfield

This repo is a fresh `create-next-app` scaffold. The `prd.md` file (1,450 lines) is the **target spec** for a product called **ClientConnect Portal** — a multi-tenant client portal with three roles (Super Admin, Team Member, Client), JWT auth, dynamic requirement forms, file uploads, threaded comments, and an admin analytics dashboard.

Almost nothing in `prd.md` is implemented yet. The non-scaffold code so far: the full shadcn/ui kit under `components/ui/` (~44 components), `lib/utils.ts` (`cn()`), and `hooks/use-mobile.ts`. No routes, API handlers, auth, database, or feature code exists. When the user asks to implement something, treat `prd.md` as the source of truth for requirements, schema, and API shape — but reconcile it against the actual code, since `prd.md` will go stale as work proceeds.

### Where `prd.md` conflicts with the code

- **Routing:** `prd.md` describes the `pages/` directory and `pages/api/*` route handlers. The actual project uses the **App Router** (`app/`). New routes must go under `app/` using App Router conventions (route handlers in `app/.../route.ts`, server components by default, `next/font`, etc.). Do not create a `pages/` directory.
- **Prisma:** `prd.md` references `prisma/` and `lib/prisma.ts`. Neither exists yet — `DATABASE_URL` is configured in `.env.local`, but Prisma is **not** in `package.json` dependencies. Adding the data layer is its own task; flag it rather than silently assuming it's there.
- **Auth:** `prd.md` assumes `jsonwebtoken` + `bcrypt`. Neither is installed. Next.js 16 has built-in auth primitives worth checking in `node_modules/next/dist/docs/` before reaching for third-party packages.

## Tech stack (what's actually installed)

- **Next.js 16.2.9, React 19.2.4** — bleeding edge. The `AGENTS.md` rule applies: read `node_modules/next/dist/docs/01-app/` (getting-started, guides, api-reference) before writing Next.js code. Heed deprecation notices — APIs you remember from training data may have moved or been removed.
- **Tailwind CSS v4** — configured via PostCSS, theme tokens defined as CSS variables in `app/globals.css` (oklch color space). No `tailwind.config.js`; v4 uses CSS-first config.
- **shadcn/ui** — `style: "radix-nova"` per `components.json`. Components live in `components/ui/`. Aliases: `@/components`, `@/components/ui`, `@/lib`, `@/lib/utils`, `@/hooks`. Icon library is `lucide-react`.
- **TypeScript** — `strict: true`, path alias `@/*` → project root.

## Available agent skills

Skills vendored under `.agents/skills/` (registered in `skills-lock.json`) cover Next.js 16 specifics (`next-best-practices`, `next-cache-components`, `next-upgrade`), shadcn (`shadcn`), and Vercel deploy/perf/composition patterns. Prefer these over guessing Next 16 / shadcn behavior.
