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
import { LayoutDashboard, FileText, MessageSquare, Upload, Bell, LogOut, UsersRound, User, PanelRight } from 'lucide-react'

type BrandSettings = {
  brandColor?: string | null
  logoUrl?: string | null
  portalTitle?: string | null
  customCss?: string | null
  hideBranding?: boolean
}

function nav(slug: string) {
  return [
    { href: `/dashboard/visitor/${slug}`, label: 'Dashboard', icon: LayoutDashboard },
    { href: `/dashboard/visitor/${slug}/forms`, label: 'Forms', icon: FileText },
    { href: `/dashboard/visitor/${slug}/messages`, label: 'Messages', icon: MessageSquare },
    { href: `/dashboard/visitor/${slug}/files`, label: 'Files', icon: Upload },
    { href: `/dashboard/visitor/${slug}/team`, label: 'Your team', icon: UsersRound },
    { href: `/dashboard/visitor/${slug}/notifications`, label: 'Notifications', icon: Bell },
    { href: `/dashboard/visitor/${slug}/profile`, label: 'Profile', icon: User },
  ]
}

function ClientHeader() {
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

export function ClientShell({
  user,
  slug,
  children,
  settings,
}: {
  user: { email: string; name: string | null }
  slug: string
  children: React.ReactNode
  settings?: BrandSettings
}) {
  const pathname = usePathname()

  const brandColor = settings?.brandColor ?? '#0EA5E9'
  const portalTitle = settings?.portalTitle || 'CLIENTCONNECT'
  const shortTitle = portalTitle.slice(0, 2).toUpperCase()

  return (
    <>
      {settings?.customCss && (
        <style>{settings.customCss}</style>
      )}
      <SidebarProvider defaultOpen={true}>
        <Sidebar collapsible="icon">
          <SidebarHeader
            className="bg-[var(--brand-color,#0EA5E9)] text-white"
            style={{ '--brand-color': brandColor } as React.CSSProperties}
          >
            <div className="px-2 py-1 group-data-[collapsible=icon]:px-1">
              {settings?.logoUrl ? (
                <img
                  src={settings.logoUrl}
                  alt={portalTitle}
                  className="h-8 w-auto max-w-[120px] object-contain brightness-0 invert group-data-[collapsible=icon]:hidden"
                />
              ) : (
                <span className="font-heading text-xl leading-none tracking-wide group-data-[collapsible=icon]:hidden">
                  {portalTitle}
                </span>
              )}
              <span className="hidden font-heading text-lg leading-none group-data-[collapsible=icon]:inline text-white">
                {settings?.logoUrl ? (
                  <img src={settings.logoUrl} alt="" className="h-6 w-auto brightness-0 invert" />
                ) : (
                  shortTitle
                )}
              </span>
              {!settings?.hideBranding && (
                <div className="text-xs text-white/70 group-data-[collapsible=icon]:hidden">
                  Client portal
                </div>
              )}
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
          <ClientHeader />
          <main className="flex-1 p-8 overflow-x-auto">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </>
  )
}
