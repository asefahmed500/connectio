# 05 — Forms & Submissions

**Status:** Draft
**Models:** `Form`, `Submission`
**Constraint:** `@@unique([clientId, formId])` — one submission per client per form.

Forms are defined by admins in a JSON schema stored on `Form.formSchema`. Submissions are JSON blobs validated against that schema at write time.

## Form schema shape

`Form.formSchema` is a JSON object describing a list of fields. The schema is interpreted by a single renderer (`components/forms/SubmissionForm.tsx`) and a single validator (`lib/forms/validate.ts`). Adding a new field type means updating both — there is no plugin system by design.

```ts
// lib/forms/schema.ts
export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'email'
  | 'url'
  | 'date'
  | 'select'
  | 'multiselect'
  | 'radio'
  | 'checkbox'
  | 'file'           // links to a File row via storageKey
  | 'richtext'

export interface FieldSchema {
  name: string                  // key in formData
  label: string
  type: FieldType
  required: boolean
  placeholder?: string
  help?: string
  options?: { label: string; value: string }[]   // for select/multiselect/radio
  minLength?: number
  maxLength?: number
  min?: number                  // for number/date
  max?: number
  pattern?: string              // regex source; flags implied
  accept?: string[]             // mime types for file
  maxSizeBytes?: number         // per-file size cap
  dependsOn?: { field: string; equals: string } // conditional visibility
}

export interface FormSchemaV1 {
  version: 1
  fields: FieldSchema[]
}
```

**Versioning:** the `version` field lets us evolve the schema format. `validate.ts` switches on version. We never mutate `formSchema` of a deployed `Form` — instead, create a new `Form` row and deactivate the old one (`isActive = false`).

## Example form

```json
{
  "version": 1,
  "fields": [
    {
      "name": "projectName",
      "label": "Project name",
      "type": "text",
      "required": true,
      "maxLength": 120
    },
    {
      "name": "budget",
      "label": "Budget range",
      "type": "select",
      "required": true,
      "options": [
        { "label": "< $10k",  "value": "lt_10k" },
        { "label": "$10–25k", "value": "10_25" },
        { "label": "$25–50k", "value": "25_50" },
        { "label": "$50k+",   "value": "gt_50" }
      ]
    },
    {
      "name": "brief",
      "label": "Project brief",
      "type": "richtext",
      "required": true,
      "maxLength": 5000
    },
    {
      "name": "timelineWeeks",
      "label": "Timeline (weeks)",
      "type": "number",
      "required": false,
      "min": 1,
      "max": 104
    }
  ]
}
```

## Validation pipeline

```
Client Component
   │  (user types, presses Submit)
   ▼
Server Action (registerAction → submitFormAction)
   │  1. Zod-verify formId + clientId belong together
   │  2. Load Form.formSchema
   │  3. validateSubmission(schema, formData) → { data } | { errors }
   │  4. If valid: write Submission row, return success
   │  5. If invalid: return errors for useActionState
```

The validator builds a Zod schema dynamically from `FormSchemaV1`:

```ts
// lib/forms/validate.ts
import 'server-only'
import { z } from 'zod'
import type { FormSchemaV1, FieldSchema } from './schema'

export function buildZodSchema(form: FormSchemaV1): z.ZodObject<z.ZodRawShape> {
  const shape: z.ZodRawShape = {}
  for (const f of form.fields) {
    shape[f.name] = fieldToZod(f)
  }
  return z.object(shape)
}

function fieldToZod(f: FieldSchema): z.ZodTypeAny {
  let s: z.ZodTypeAny
  switch (f.type) {
    case 'text':
    case 'textarea':
    case 'richtext':
      s = z.string().trim()
      if (f.minLength) s = (s as z.ZodString).min(f.minLength)
      if (f.maxLength) s = (s as z.ZodString).max(f.maxLength)
      break
    case 'number':
      s = z.coerce.number()
      if (f.min !== undefined) s = (s as z.ZodNumber).min(f.min)
      if (f.max !== undefined) s = (s as z.ZodNumber).max(f.max)
      break
    case 'email': s = z.email(); break
    case 'url':   s = z.url(); break
    case 'date':  s = z.coerce.date(); break
    case 'select':
    case 'radio':
      s = z.enum(f.options!.map(o => o.value) as [string, ...string[]])
      break
    case 'multiselect':
    case 'checkbox':
      s = z.array(z.enum(f.options!.map(o => o.value) as [string, ...string[]]))
      break
    case 'file':
      s = z.string().regex(/^clients\/[^/]+\/submissions\/[^/]+\/[a-f0-9-]+$/)
      break
    default: s = z.unknown()
  }
  return f.required ? s : z.optional(s.nullish())
}

export function validateSubmission(form: FormSchemaV1, formData: unknown) {
  return buildZodSchema(form).safeParse(formData)
}
```

**Important:** the Zod schema is built **server-side**, from the DB-loaded `Form.formSchema`. The client-side render uses the same JSON to render inputs but the client never trusts its own validation.

## Submission lifecycle

```
                create (POST)
                    │
                    ▼
                 ┌────────┐  autosave      ┌────────┐
                 │ DRAFT  │ ◀───────────── │ DRAFT  │
                 └────┬───┘                └────────┘
                      │ submit
                      ▼
                 ┌──────────┐
                 │SUBMITTED │
                 └────┬─────┘
                      │ admin/team triage
              ┌───────┴───────┐
              ▼               ▼
         ┌──────────┐    ┌──────────────┐
         │IN_REVIEW │    │CHANGES_REQ.  │ ─▶ client edits → SUBMITTED
         └────┬─────┘    └──────────────┘
              │ decision
        ┌─────┴─────┐
        ▼           ▼
   ┌─────────┐ ┌──────────┐
   │APPROVED │ │ REJECTED │
   └─────────┘ └──────────┘
                  (terminal)
```

Rules:
- `DRAFT → SUBMITTED`: client action. Sets `submittedAt`.
- `SUBMITTED → IN_REVIEW | CHANGES_REQUESTED`: admin/team.
- `IN_REVIEW → APPROVED | REJECTED | CHANGES_REQUESTED`: admin/team. Sets `reviewedBy`, `reviewedAt`.
- `CHANGES_REQUESTED → SUBMITTED`: client re-submits.
- `APPROVED` / `REJECTED` are terminal. To re-open, create a new Form instance.

The transition table is enforced in the DAL (`updateSubmissionStatus`):

```ts
const ALLOWED: Record<SubmissionStatus, SubmissionStatus[]> = {
  DRAFT:            ['SUBMITTED'],
  SUBMITTED:        ['IN_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'REJECTED'],
  IN_REVIEW:        ['APPROVED', 'REJECTED', 'CHANGES_REQUESTED'],
  CHANGES_REQUESTED:['SUBMITTED'],
  APPROVED:         [],
  REJECTED:         [],
}

export async function updateSubmissionStatus(id: string, next: SubmissionStatus) {
  const sub = await prisma.submission.findUniqueOrThrow({ where: { id } })
  await requireSubmissionAccess(sub.clientId)
  if (!ALLOWED[sub.status].includes(next)) {
    throw new TransitionError(sub.status, next)
  }
  await prisma.submission.update({
    where: { id },
    data: {
      status: next,
      reviewedBy: ['APPROVED', 'REJECTED'].includes(next) ? (await requireRole('SUPER_ADMIN', 'TEAM_MEMBER')).sub : undefined,
      reviewedAt: ['APPROVED', 'REJECTED'].includes(next) ? new Date() : undefined,
      submittedAt: next === 'SUBMITTED' ? new Date() : undefined,
    },
  })
}
```

## Write path (Server Action)

```ts
// app/(client)/dashboard/visitor/[slug]/submissions/[id]/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireClientAccess } from '@/lib/dal/session'
import { validateSubmission } from '@/lib/forms/validate'

export async function saveSubmissionAction(prevState: unknown, formData: FormData) {
  const clientId = formData.get('clientId') as string
  const formId   = formData.get('formId')   as string
  const isDraft  = formData.get('isDraft') === 'true'

  await requireClientAccess(clientId)

  const form = await prisma.form.findFirstOrThrow({
    where: { id: formId, isActive: true },
  })

  // Build a plain object from FormData (handle arrays for multiselect).
  const values = formFieldsToObject(formData, form.formSchema as FormSchemaV1)

  if (!isDraft) {
    const parsed = validateSubmission(form.formSchema as FormSchemaV1, values)
    if (!parsed.success) {
      return { error: 'Validation failed', fields: parsed.error.flatten().fieldErrors }
    }
    values = parsed.data
  }

  // Upsert: @@unique([clientId, formId]) makes this safe.
  const updated = await prisma.submission.upsert({
    where: { clientId_formId: { clientId, formId } },
    create: { clientId, formId, formData: values, status: isDraft ? 'DRAFT' : 'SUBMITTED', submittedAt: isDraft ? null : new Date() },
    update: { formData: values, status: isDraft ? undefined : 'SUBMITTED', submittedAt: isDraft ? undefined : new Date() },
  })

  revalidatePath(`/dashboard/visitor/<slug>/submissions/${updated.id}`)
  return { success: true, status: updated.status }
}
```

Notes:
- **Drafts skip full validation** but still type-check (no required-check). A draft can save a half-filled form.
- **`upsert` is keyed on `clientId_formId`** — the `@@unique` constraint makes this work. If a draft exists, we update; otherwise we create.
- **`revalidatePath`** with the *current* path pattern — the `<slug>` in the URL becomes a real slug at request time; the cache key uses the actual URL.

## Read path

Server Component fetches via DAL:

```tsx
// app/(client)/dashboard/visitor/[slug]/submissions/[id]/page.tsx
import { getSubmissionDTO } from '@/lib/dal/submissions'
import { SubmissionForm } from '@/components/forms/SubmissionForm'

export default async function Page({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { id } = await params
  const dto = await getSubmissionDTO(id)   // calls requireClientAccess internally
  return <SubmissionForm submission={dto} />
}
```

`getSubmissionDTO(id)`:
1. Looks up `Submission` by id with `form` and `files` included.
2. Calls `requireClientAccess(submission.clientId)` — this throws `forbidden()` if the viewer can't access this client.
3. Returns a DTO that strips internal fields (`reviewedBy`, internal comments) when the viewer is the Client.

## Form builder UI

Super Admin-only, under `/admin/forms`. Lets the admin design a form by adding/removing/reordering fields. Saves `formSchema` JSON.

The builder enforces the schema version (`1`) and validates against the same `FormSchemaV1` Zod schema that the renderer uses — guaranteeing what you build is what gets rendered.

## Open questions

- **Re-submit policy.** PRD allows re-submit after CHANGES_REQUESTED. After APPROVED, do we allow re-opening? Current design: no. Create a new Form.
- **File fields.** Treated as strings (storage keys). The upload itself happens via the `/api/uploads` route handler; the submission only stores the resulting key. See `07-uploads.md`.
- **Revision history.** Out of scope v1. If added later, add a `SubmissionRevision` table keyed by submissionId.
