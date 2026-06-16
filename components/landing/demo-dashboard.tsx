import { Card, CardContent, CardHeader, CardDescription, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Building2, Users, FileText, MessageSquare, Upload, ArrowUpRight, CheckCircle2, Clock, AlertCircle } from 'lucide-react'

const SIDEBAR_ITEMS = [
  { label: 'Dashboard', active: true },
  { label: 'Clients' },
  { label: 'Forms' },
  { label: 'Submissions' },
  { label: 'Messages' },
  { label: 'Files' },
  { label: 'Team' },
  { label: 'Settings' },
]

const RECENT_CLIENTS = [
  { name: 'Acme Corp', contact: 'alice@acme.com', status: 'active' as const, subs: 4, msgs: 2 },
  { name: 'BuildRight Inc', contact: 'bob@buildright.com', status: 'pending' as const, subs: 1, msgs: 5 },
  { name: 'Crestview Partners', contact: 'carol@crestview.com', status: 'active' as const, subs: 7, msgs: 12 },
  { name: 'DesignLab Studio', contact: 'dan@designlab.io', status: 'new' as const, subs: 0, msgs: 1 },
  { name: 'Evergreen Homes', contact: 'eve@evergreen.com', status: 'active' as const, subs: 3, msgs: 8 },
]

const RECENT_SUBMISSIONS = [
  { title: 'Project intake — Q3', client: 'Acme Corp', status: 'pending' as const, date: '2026-06-14' },
  { title: 'Budget approval — Q3', client: 'Crestview Partners', status: 'approved' as const, date: '2026-06-13' },
  { title: 'Scope change request', client: 'BuildRight Inc', status: 'changes' as const, date: '2026-06-12' },
  { title: 'Final delivery sign-off', client: 'Evergreen Homes', status: 'review' as const, date: '2026-06-11' },
]

function statusBadge(status: string) {
  switch (status) {
    case 'active':
    case 'approved':
      return <Badge variant="default" className="bg-emerald-600/10 text-emerald-700 hover:bg-emerald-600/15 border-0">Approved</Badge>
    case 'pending':
    case 'review':
      return <Badge variant="secondary">In review</Badge>
    case 'changes':
      return <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50">Changes</Badge>
    case 'new':
      return <Badge variant="outline">New</Badge>
    default:
      return <Badge variant="outline">Draft</Badge>
  }
}

export function DemoDashboard() {
  return (
    <section className="w-full bg-gradient-to-b from-background to-muted/30 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 flex flex-col items-center gap-4 text-center mb-12">
        <h2 className="text-3xl font-heading tracking-wide sm:text-4xl text-balance">
          What you&apos;ll use every day
        </h2>
        <p className="text-muted-foreground max-w-md text-balance">
          A clean dashboard for managing clients, forms, and submissions across your team.
        </p>
      </div>

      <div className="mx-auto max-w-7xl px-6">
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          {/* Mini top bar */}
          <div className="flex items-center justify-between h-10 border-b px-4 bg-muted/20">
            <div className="flex items-center gap-2">
              <div className="size-2.5 rounded-full bg-destructive/70" />
              <div className="size-2.5 rounded-full bg-amber-400/70" />
              <div className="size-2.5 rounded-full bg-emerald-500/70" />
            </div>
            <span className="text-xs font-mono text-muted-foreground">secure.clientconnect.io</span>
            <div />
          </div>

          <div className="flex min-h-[500px]">
            {/* Sidebar */}
            <aside className="hidden sm:flex flex-col w-56 border-r bg-muted/10 shrink-0">
              <div className="px-4 pt-4 pb-3">
                <div className="font-heading text-base tracking-wide text-foreground">CLIENTCONNECT</div>
                <div className="text-[10px] text-muted-foreground">Admin panel</div>
              </div>
              <Separator />
              <nav className="flex-1 p-2 flex flex-col gap-0.5">
                {SIDEBAR_ITEMS.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    disabled
                    className={`w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors cursor-default ${
                      item.active
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </nav>
            </aside>

            {/* Main content */}
            <div className="flex-1 min-w-0 p-5 flex flex-col gap-5">
              {/* Page header */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-heading tracking-wide">Dashboard</h3>
                  <p className="text-xs text-muted-foreground">Activity across all clients.</p>
                </div>
                <div className="hidden sm:flex items-center gap-2">
                  <span className="text-xs text-muted-foreground bg-muted/50 px-3 py-1 rounded-full border">
                    Last 14 days
                  </span>
                </div>
              </div>

              {/* Stat cards grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card>
                  <CardHeader className="p-3 pb-1">
                    <CardDescription className="flex items-center gap-1">
                      <Building2 className="size-3" />
                      Clients
                    </CardDescription>
                    <CardTitle className="text-xl tabular-nums">24</CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="p-3 pb-1">
                    <CardDescription className="flex items-center gap-1">
                      <FileText className="size-3" />
                      Submissions
                    </CardDescription>
                    <CardTitle className="text-xl tabular-nums">142</CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="p-3 pb-1">
                    <CardDescription className="flex items-center gap-1">
                      <MessageSquare className="size-3" />
                      Messages
                    </CardDescription>
                    <CardTitle className="text-xl tabular-nums">89</CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="p-3 pb-1">
                    <CardDescription className="flex items-center gap-1">
                      <Upload className="size-3" />
                      Files
                    </CardDescription>
                    <CardTitle className="text-xl tabular-nums">56</CardTitle>
                  </CardHeader>
                </Card>
              </div>

              {/* Two-column layout */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Clients table */}
                <Card>
                  <CardHeader className="px-4 py-3">
                    <CardTitle className="text-sm font-medium">Recent clients</CardTitle>
                  </CardHeader>
                  <CardContent className="px-0 pb-0">
                    <div className="divide-y">
                      {RECENT_CLIENTS.map((c) => (
                        <div key={c.name} className="flex items-center justify-between px-4 py-2.5 text-sm">
                          <div className="flex flex-col min-w-0">
                            <span className="font-medium truncate">{c.name}</span>
                            <span className="text-xs text-muted-foreground truncate">{c.contact}</span>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-xs text-muted-foreground tabular-nums">
                              {c.subs} sub · {c.msgs} msg
                            </span>
                            {statusBadge(c.status)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Submissions table */}
                <Card>
                  <CardHeader className="px-4 py-3">
                    <CardTitle className="text-sm font-medium">Recent submissions</CardTitle>
                  </CardHeader>
                  <CardContent className="px-0 pb-0">
                    <div className="divide-y">
                      {RECENT_SUBMISSIONS.map((s) => (
                        <div key={s.title} className="flex items-center justify-between px-4 py-2.5 text-sm">
                          <div className="flex flex-col min-w-0">
                            <span className="font-medium truncate">{s.title}</span>
                            <span className="text-xs text-muted-foreground">{s.client}</span>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-xs text-muted-foreground tabular-nums hidden sm:inline">{s.date}</span>
                            {statusBadge(s.status)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Bottom row: activity */}
              <Card>
                <CardHeader className="px-4 py-3">
                  <CardTitle className="text-sm font-medium">Recent activity</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 flex flex-col gap-2">
                  <ActivityRow icon={CheckCircle2} color="text-emerald-600" text="Acme Corp submitted Project intake — Q3" time="2h ago" />
                  <ActivityRow icon={MessageSquare} color="text-primary" text="Crestview Partners replied to Budget approval" time="4h ago" />
                  <ActivityRow icon={AlertCircle} color="text-amber-600" text="BuildRight Inc requested changes on Scope change" time="1d ago" />
                  <ActivityRow icon={Clock} color="text-muted-foreground" text="Evergreen Homes uploaded 3 new files" time="2d ago" />
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function ActivityRow({ icon: Icon, color, text, time }: { icon: React.ElementType; color: string; text: string; time: string }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <Icon className={`size-4 shrink-0 ${color}`} />
      <span className="flex-1 min-w-0 truncate">{text}</span>
      <span className="text-xs text-muted-foreground shrink-0">{time}</span>
    </div>
  )
}
