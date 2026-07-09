import { BarChart } from '@/components/analytics/bar-chart'
import { getClientGrowthTrend } from '@/lib/dal/analytics'

export async function ClientGrowthChart() {
  const trend = await getClientGrowthTrend(14)
  const totalNew = trend.reduce((sum, b) => sum + b.count, 0)

  return (
    <div className="flex flex-col gap-2">
      {totalNew === 0 ? (
        <p className="text-sm text-muted-foreground py-4">No new clients this period.</p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {totalNew} new client{totalNew === 1 ? '' : 's'} in the last 14 days
          </p>
          <BarChart
            data={trend.map((b) => ({
              label: b.label,
              value: b.count,
              hint: `${b.count} new client${b.count === 1 ? '' : 's'}`,
            }))}
          />
        </>
      )}
    </div>
  )
}
