import { requireRole } from '@/lib/dal/session'
import { listActiveSessions } from '@/lib/dal/sessions-admin'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { RevokeSessionButton } from './revoke-button'
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table'

export const metadata = { title: 'Active sessions — ClientConnect' }

function timeAgo(d: Date): string {
  const sec = Math.floor((Date.now() - d.getTime()) / 1000)
  if (sec < 60) return `${sec}s ago`
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`
  return `${Math.floor(sec / 86400)}d ago`
}

function summarizeUa(ua: string | null): string {
  if (!ua) return '—'
  // Extract browser + OS family from a typical UA without a parser dep.
  const browser = ua.match(/(Firefox|Chrome|Safari|Edge|OPR)\/[\d.]+/)?.[0]?.split('/')[0] ?? 'Unknown'
  const os = ua.match(/\(([^)]+)\)/)?.[1] ?? ''
  const osShort = os.split(';')[0]?.slice(0, 40) ?? 'Unknown OS'
  return `${browser} · ${osShort}`
}

export default async function ActiveSessionsPage() {
  await requireRole('SUPER_ADMIN')
  const sessions = await listActiveSessions()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-heading tracking-wide">Active sessions</h1>
        <p className="text-sm text-muted-foreground">
          Currently signed-in users across the system. Revoke any session to force sign-out.
        </p>
      </div>

      {sessions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No active sessions.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Signed in</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{s.userName}</span>
                          <span className="text-xs text-muted-foreground">{s.userEmail}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{s.userRole.replace('_', ' ')}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{s.ip ?? '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[260px] truncate">
                        {summarizeUa(s.userAgent)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {timeAgo(s.createdAt)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {timeAgo(s.expiresAt)}
                      </TableCell>
                      <TableCell>
                        <RevokeSessionButton sessionId={s.id} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
