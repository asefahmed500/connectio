import { Badge } from '@/components/ui/badge'

const VARIANTS: Record<string, { variant: 'default' | 'secondary' | 'outline' | 'destructive'; className?: string }> = {
  APPROVED: { variant: 'default', className: 'bg-emerald-600/10 text-emerald-700 hover:bg-emerald-600/15 border-0' },
  SUBMITTED: { variant: 'secondary' },
  IN_REVIEW: { variant: 'outline', className: 'border-blue-300 text-blue-700 bg-blue-50' },
  CHANGES_REQUESTED: { variant: 'outline', className: 'border-amber-300 text-amber-700 bg-amber-50' },
  REJECTED: { variant: 'destructive' },
  DRAFT: { variant: 'outline' },
}

const LABELS: Record<string, string> = {
  APPROVED: 'Approved',
  SUBMITTED: 'Submitted',
  IN_REVIEW: 'In review',
  CHANGES_REQUESTED: 'Changes',
  REJECTED: 'Rejected',
  DRAFT: 'Draft',
}

export function StatusBadge({ status }: { status: string }) {
  const cfg = VARIANTS[status] ?? { variant: 'outline' as const }
  return (
    <Badge variant={cfg.variant} className={cfg.className}>
      {LABELS[status] ?? status}
    </Badge>
  )
}

export function InviteStatusBadge({ status }: { status: string }) {
  const variant =
    status === 'OPEN'
      ? 'default' as const
      : status === 'CONSUMED'
        ? 'secondary' as const
        : 'outline' as const
  const label = status === 'OPEN' ? 'Open' : status === 'CONSUMED' ? 'Consumed' : status
  return <Badge variant={variant}>{label}</Badge>
}

export function UserRoleBadge({ role }: { role: string }) {
  const variant =
    role === 'SUPER_ADMIN' ? 'default' as const
    : role === 'TEAM_MEMBER' ? 'secondary' as const
    : 'outline' as const
  return <Badge variant={variant}>{role.replace(/_/g, ' ')}</Badge>
}

export function ActiveBadge({ active }: { active: boolean }) {
  return active
    ? <Badge variant="default">Active</Badge>
    : <Badge variant="destructive">Blocked</Badge>
}
