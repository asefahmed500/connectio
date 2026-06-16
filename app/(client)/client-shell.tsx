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
import { LogOut } from 'lucide-react'

function nav(slug: string) {
  return [
    { href: `/dashboard/visitor/${slug}`, label: 'Dashboard' },
    { href: `/dashboard/visitor/${slug}/forms`, label: 'Forms' },
    { href: `/dashboard/visitor/${slug}/messages`, label: 'Messages' },
    { href: `/dashboard/visitor/${slug}/files`, label: 'Files' },
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
    <SidebarProvider defaultOpen={false}>
      <Sidebar>
        <SidebarHeader>
          <div className="px-2 py-1">
            <div className="font-heading text-xl leading-none tracking-wide">CLIENTCONNECT</div>
            <div className="text-xs text-muted-foreground">Client portal</div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {nav(slug).map((item) => {
              const active = pathname === item.href
              return (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={active}>
                    <Link href={item.href}>{item.label}</Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarContent>
        <SidebarSeparator />
        <SidebarFooter>
          <div className="flex flex-col gap-2 px-2">
            <span className="text-xs text-muted-foreground truncate">
              {user.email}
            </span>
            <form action={logoutAction}>
              <Button
                type="submit"
                variant="outline"
                size="sm"
                className="w-full"
              >
                <LogOut data-icon="inline-start" />
                Sign out
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
