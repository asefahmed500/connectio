import type { SubmissionStatus } from '@prisma/client'
import type { StatusBreakdown } from '@/lib/dal/analytics'

const ORDER: SubmissionStatus[] = [
  'DRAFT',
  'SUBMITTED',
  'IN_REVIEW',
  'CHANGES_REQUESTED',
  'APPROVED',
  'REJECTED',
]

const COLORS: Record<SubmissionStatus, string> = {
  DRAFT: 'bg-muted',
  SUBMITTED: 'bg-blue-500',
  IN_REVIEW: 'bg-amber-500',
  CHANGES_REQUESTED: 'bg-orange-500',
  APPROVED: 'bg-emerald-500',
  REJECTED: 'bg-red-500',
}

export function StatusBreakdown({ breakdown }: { breakdown: StatusBreakdown }) {
  const total = ORDER.reduce((sum, s) => sum + (breakdown[s] ?? 0), 0)

  if (total === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        No submissions yet. Activate a form to start collecting.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {/* Stacked bar */}
      <div className="h-3 rounded-full overflow-hidden flex bg-muted">
        {ORDER.map((s) => {
          const count = breakdown[s]
          if (count === 0) return null
          const pct = (count / total) * 100
          return (
            <div
              key={s}
              className={COLORS[s]}
              style={{ width: `${pct}%` }}
              title={`${s.replace('_', ' ')}: ${count} (${pct.toFixed(0)}%)`}
            />
          )
        })}
      </div>

      {/* Legend with counts */}
      <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
        {ORDER.map((s) => (
          <li key={s} className="flex items-center gap-2">
            <span className={`size-2.5 rounded-sm ${COLORS[s]}`} />
            <span className="text-muted-foreground flex-1">{s.replace('_', ' ').toLowerCase()}</span>
            <span className="tabular-nums font-medium">{breakdown[s]}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
