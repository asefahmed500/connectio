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
  SidebarTrigger,
  SidebarInset,
  SidebarSeparator,
} from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { NotificationsBell } from '@/components/notifications/notifications-bell'
import { logoutAction } from '@/app/(auth)/logout/actions'
import { LayoutDashboard, FileText, MessageSquare, Upload, Bell, LogOut } from 'lucide-react'

function nav(slug: string) {
  return [
    { href: `/dashboard/visitor/${slug}`, label: 'Dashboard', icon: LayoutDashboard },
    { href: `/dashboard/visitor/${slug}/forms`, label: 'Forms', icon: FileText },
    { href: `/dashboard/visitor/${slug}/messages`, label: 'Messages', icon: MessageSquare },
    { href: `/dashboard/visitor/${slug}/files`, label: 'Files', icon: Upload },
    { href: `/dashboard/visitor/${slug}/notifications`, label: 'Notifications', icon: Bell },
  ]
}

export function ClientShell({
  user,
  slug,
  children,
}: {
  user: { email: string; name: string | null }
  slug: string
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
            <div className="text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">Client portal</div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {nav(slug).map((item) => {
              const active = pathname === item.href
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
        <header className="flex h-12 shrink-0 items-center justify-between border-b px-4">
          <div className="flex items-center gap-2">
            <SidebarTrigger />
          </div>
          <NotificationsBell enabled />
        </header>
        <main className="flex-1 p-8 overflow-x-auto">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
