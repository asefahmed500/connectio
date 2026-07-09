import { requireRole } from '@/lib/dal/session'
import { listErasureRequests } from '@/lib/dal/gdpr'
import { getChainDigest } from '@/lib/dal/audit-chain'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { approveErasureAction, denyErasureAction } from './actions'

export const metadata = { title: 'GDPR — ClientConnect' }

export default async function GdprPage() {
  await requireRole('SUPER_ADMIN')
  const [requests, chain] = await Promise.all([
    listErasureRequests(),
    getChainDigest(),
  ])

  const pending = requests.filter((r) => r.status === 'PENDING')

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-heading tracking-wide">GDPR &amp; compliance</h1>
        <p className="text-sm text-muted-foreground">
          Manage data subject rights and audit chain integrity.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-heading tracking-wide">Audit chain integrity</CardTitle>
          <CardDescription className="text-xs">
            Tamper-evident hash chain for the audit log.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Total entries</span>
            <span className="tabular-nums font-medium">{chain.totalEntries.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Status</span>
            <div className="flex items-center gap-2">
              <span className={`size-2 rounded-full ${chain.verified ? 'bg-primary' : 'bg-destructive'}`} />
              <span>{chain.verified ? 'Verified' : 'Integrity check required'}</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Latest hash</span>
            <span className="font-mono text-xs text-muted-foreground">{chain.latestHash ? chain.latestHash.slice(0, 32) + '…' : 'N/A'}</span>
          </div>
          {chain.latestEntry && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Latest action</span>
              <span className="text-xs">{chain.latestEntry.action}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-heading tracking-wide">Erasure requests</CardTitle>
          <CardDescription className="text-xs">
            Right to erasure (GDPR Art 17) — PENDING: {pending.length}, TOTAL: {requests.length}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <p className="text-sm text-muted-foreground">No erasure requests.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {requests.map((req) => (
                <div
                  key={req.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div className="flex flex-col gap-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{req.userName}</span>
                      <span className="text-xs text-muted-foreground">{req.userEmail}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant={req.status === 'PENDING' ? 'default' : req.status === 'APPROVED' ? 'secondary' : 'destructive'} className="text-[10px]">
                        {req.status}
                      </Badge>
                      <span>{new Date(req.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  {req.status === 'PENDING' && (
                    <div className="flex gap-2 shrink-0">
                      <form action={approveErasureAction.bind(null, req.id)}>
                        <Button type="submit" size="sm" variant="default">Approve</Button>
                      </form>
                      <form action={denyErasureAction.bind(null, req.id)}>
                        <Button type="submit" size="sm" variant="destructive">Deny</Button>
                      </form>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
