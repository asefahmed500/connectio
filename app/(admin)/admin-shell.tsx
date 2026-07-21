'use client'

import Link from 'next/link'
import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  useSidebar,
  SidebarInset,
  SidebarSeparator,
} from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { NotificationsBell } from '@/components/notifications/notifications-bell'
import { logoutAction } from '@/app/(auth)/logout/actions'
import {
  LayoutDashboard,
  Users,
  Mail,
  Building2,
  FileText,
  UsersRound,
  Bell,
  Settings,
  LogOut,
  ScrollText,
  PanelRight,
  ShieldCheck,
  Scale,
  Fingerprint,
  Shield,
  MonitorSmartphone,
  MessageSquare,
} from 'lucide-react'

// Lazy-load the Cmd+K palette — it's only visible on keyboard shortcut
const CommandPalette = dynamic(
  () => import('@/components/admin/command-palette').then((m) => ({ default: m.CommandPalette })),
  { ssr: false },
)

const NAV = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/invites', label: 'Invites', icon: Mail },
  { href: '/admin/clients', label: 'Clients', icon: Building2 },
  { href: '/admin/forms', label: 'Forms', icon: FileText },
  { href: '/admin/team', label: 'Team', icon: UsersRound },
  { href: '/admin/comments', label: 'Comments', icon: MessageSquare },
  { href: '/admin/sessions', label: 'Sessions', icon: MonitorSmartphone },
  { href: '/admin/audit-log', label: 'Audit Log', icon: ScrollText },
  { href: '/admin/notifications', label: 'Notifications', icon: Bell },
  { href: '/admin/audit-log/chain', label: 'Audit Chain', icon: ShieldCheck },
  { href: '/admin/roles', label: 'Roles', icon: Shield },
  { href: '/admin/sso', label: 'SSO', icon: Fingerprint },
  { href: '/admin/gdpr', label: 'GDPR', icon: Scale },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
]

function AdminHeader() {
  const { toggleSidebar } = useSidebar()
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b px-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon-sm" onClick={toggleSidebar}>
          <PanelRight />
          <span className="sr-only">Toggle Sidebar</span>
        </Button>
        <span className="text-xs text-muted-foreground hidden sm:inline">
          <kbd className="rounded border px-1.5 py-0.5 text-[10px] font-mono bg-muted">&#8984;K</kbd>
        </span>
      </div>
      <div className="flex items-center gap-2">
        <NotificationsBell enabled />
      </div>
    </header>
  )
}

export function AdminShell({
  user,
  children,
}: {
  user: { email: string; name: string | null }
  children: React.ReactNode
}) {
  const pathname = usePathname()

  return (
    <SidebarProvider defaultOpen={true}>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <div className="px-2 py-1 group-data-[collapsible=icon]:px-1">
            <span className="font-heading text-xl leading-none tracking-wide group-data-[collapsible=icon]:hidden">CLIENTCONNECT</span>
            <span className="hidden font-heading text-lg leading-none group-data-[collapsible=icon]:inline">CC</span>
            <div className="text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">Admin</div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {NAV.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(item.href + '/')
              return (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                    <Link href={item.href}>
                      <item.icon />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarContent>
        <SidebarSeparator />
        <SidebarFooter>
          <div className="flex flex-col gap-2 px-2 group-data-[collapsible=icon]:px-1">
            <span className="text-xs text-muted-foreground truncate group-data-[collapsible=icon]:hidden">
              {user.email}
            </span>
            <form action={logoutAction}>
              <Button
                type="submit"
                variant="outline"
                size="sm"
                className="w-full group-data-[collapsible=icon]:px-1"
              >
                <LogOut data-icon="inline-start" />
                <span className="group-data-[collapsible=icon]:hidden">Sign out</span>
              </Button>
            </form>
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <AdminHeader />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-x-auto">{children}</main>
        <CommandPalette />
      </SidebarInset>
    </SidebarProvider>
  )
}
