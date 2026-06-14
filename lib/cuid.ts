// Tiny cuid generator. Matches the format Prisma's @default(cuid()) uses
// (cuid v2-style: lowercase letters + digits, time-sortable prefix). We
// pull in the `cuid` package lazily to avoid bloating client bundles.

import { createId } from '@paralleldrive/cuid2'

export function generateCuid(): string {
  return createId()
}
