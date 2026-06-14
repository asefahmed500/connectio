'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { NotificationsBell } from '@/components/notifications/notifications-bell'
import { logoutAction } from '@/app/(auth)/logout/actions'

const NAV = (slug: string) => [
  { href: `/dashboard/visitor/${slug}`, label: 'Dashboard' },
  { href: `/dashboard/visitor/${slug}/forms`, label: 'Forms' },
  { href: `/dashboard/visitor/${slug}/messages`, label: 'Messages' },
  { href: `/dashboard/visitor/${slug}/files`, label: 'Files' },
]

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
    <div className="min-h-screen flex bg-background">
      <aside className="w-56 border-r bg-muted/30 p-4 flex flex-col">
        <div className="px-2 py-3 mb-2">
          <div className="font-semibold leading-tight">ClientConnect</div>
          <div className="text-xs text-muted-foreground">Client portal</div>
        </div>
        <nav className="space-y-1 flex-1">
          {NAV(slug).map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                className={
                  'block px-3 py-2 rounded-md text-sm transition-colors ' +
                  (active
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted text-foreground/80')
                }
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
        <div className="pt-4 mt-4 border-t space-y-2">
          <div className="flex items-center justify-between px-2">
            <span className="text-xs text-muted-foreground truncate flex-1">{user.email}</span>
            <NotificationsBell enabled />
          </div>
          <form action={logoutAction}>
            <Button type="submit" variant="outline" size="sm" className="w-full">
              Sign out
            </Button>
          </form>
        </div>
      </aside>
      <main className="flex-1 p-8 overflow-x-auto">{children}</main>
    </div>
  )
}
