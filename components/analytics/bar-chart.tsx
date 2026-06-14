// Hand-rolled bar chart. Avoids pulling in recharts/visx for what's a 30-line
// column of divs. If we need richer viz later (tooltips, axes, multi-series),
// swap to recharts and keep this component's interface.

export function BarChart({
  data,
  emptyLabel = 'No data yet',
}: {
  data: { label: string; value: number; hint?: string }[]
  emptyLabel?: string
}) {
  const max = Math.max(...data.map((d) => d.value), 1)
  const nonZero = data.some((d) => d.value > 0)

  if (!nonZero) {
    return (
      <div className="h-32 grid place-items-center text-sm text-muted-foreground">
        {emptyLabel}
      </div>
    )
  }

  return (
    <div className="flex items-end gap-1 h-32">
      {data.map((d, i) => {
        const pct = (d.value / max) * 100
        return (
          <div
            key={`${d.label}-${i}`}
            className="flex-1 flex flex-col items-center justify-end gap-1 min-w-0"
            title={`${d.label}: ${d.value}${d.hint ? ` (${d.hint})` : ''}`}
          >
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {d.value > 0 ? d.value : ''}
            </span>
            <div
              className="w-full rounded-t bg-primary/70 hover:bg-primary transition-colors"
              style={{ height: `${Math.max(pct, d.value > 0 ? 4 : 0)}%` }}
            />
            <span className="text-[10px] text-muted-foreground truncate w-full text-center">
              {d.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}
