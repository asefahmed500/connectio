import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

export type BreadcrumbSegment = {
  label: string
  href?: string
}

export function Breadcrumbs({ segments }: { segments: BreadcrumbSegment[] }) {
  return (
    <nav className="flex items-center gap-1 text-sm text-muted-foreground mb-1">
      {segments.map((s, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="h-3 w-3" />}
          {s.href ? (
            <Link href={s.href} className="hover:text-foreground transition-colors">
              {s.label}
            </Link>
          ) : (
            <span className="text-foreground font-medium">{s.label}</span>
          )}
        </span>
      ))}
    </nav>
  )
}
