'use client'

import Link from 'next/link'
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
import { LayoutDashboard, Building2, Bell, LogOut, PanelRight } from 'lucide-react'

const NAV = [
  { href: '/team', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/team/clients', label: 'My clients', icon: Building2 },
  { href: '/team/notifications', label: 'Notifications', icon: Bell },
]

function TeamHeader() {
  const { toggleSidebar } = useSidebar()
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b px-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon-sm" onClick={toggleSidebar}>
          <PanelRight />
          <span className="sr-only">Toggle Sidebar</span>
        </Button>
      </div>
      <NotificationsBell enabled />
    </header>
  )
}

export function TeamShell({
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
            <div className="text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">Team</div>
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
        <TeamHeader />
        <main className="flex-1 p-8 overflow-x-auto">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
