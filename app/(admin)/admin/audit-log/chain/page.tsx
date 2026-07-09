import { requireRole } from '@/lib/dal/session'
import { getChainDigest, verifyAuditChain } from '@/lib/dal/audit-chain'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { runChainVerificationAction } from './actions'

export const metadata = { title: 'Audit chain — ClientConnect' }

export default async function AuditChainPage() {
  await requireRole('SUPER_ADMIN')
  const digest = await getChainDigest()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-heading tracking-wide">Audit chain verification</h1>
        <p className="text-sm text-muted-foreground">
          Tamper-evident hash chain. Each audit log entry stores the SHA-256 of itself
          linked to the previous entry. Run a full verification to confirm integrity.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-heading tracking-wide">Current state</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Total entries</span>
            <span className="tabular-nums font-medium">{digest.totalEntries.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Chain status</span>
            <div className="flex items-center gap-2">
              <span className={`size-2 rounded-full ${digest.verified ? 'bg-primary' : 'bg-destructive'}`} />
              <Badge variant={digest.verified ? 'default' : 'destructive'} className="text-[10px]">
                {digest.verified ? 'UNTOUCHED' : 'TAMPERED'}
              </Badge>
            </div>
          </div>
          {digest.latestEntry && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Latest action</span>
                <span className="font-mono text-xs">{digest.latestEntry.action}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Latest hash</span>
                <span className="font-mono text-xs text-muted-foreground max-w-[300px] truncate">
                  {digest.latestHash}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Latest at</span>
                <span className="text-xs">{digest.latestEntry.createdAt.toISOString()}</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-heading tracking-wide">Full verification</CardTitle>
          <CardDescription className="text-xs">
            Recompute every hash and compare against stored values. This checks the
            integrity of the entire audit chain (up to the first 1000 entries).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={runChainVerificationAction}>
            <Button type="submit">Run chain verification</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
