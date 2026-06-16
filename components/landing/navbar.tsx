'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'

const NAV = [
  { href: '/login', label: 'Sign in' },
]

export function Navbar() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <nav className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-2xl">
      <div className="flex items-center justify-between rounded-full border bg-card/90 backdrop-blur-md px-6 py-2.5 shadow-sm">
        <Link href="/" className="font-heading text-lg tracking-wide text-foreground">
          CLIENTCONNECT
        </Link>
        <div className="hidden sm:flex items-center gap-1">
          {NAV.map((item) => {
            const active = pathname === item.href
            return (
              <Button
                key={item.href}
                variant={active ? 'default' : 'ghost'}
                size="sm"
                asChild
              >
                <Link href={item.href}>{item.label}</Link>
              </Button>
            )
          })}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="sm:hidden"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          {open ? <X /> : <Menu />}
        </Button>
      </div>
      {open && (
        <div className="mt-2 rounded-2xl border bg-card p-3 flex flex-col gap-1 sm:hidden shadow-sm">
          {NAV.map((item) => {
            const active = pathname === item.href
            return (
              <Button
                key={item.href}
                variant={active ? 'default' : 'ghost'}
                size="sm"
                asChild
                className="justify-start"
                onClick={() => setOpen(false)}
              >
                <Link href={item.href}>{item.label}</Link>
              </Button>
            )
          })}
        </div>
      )}
    </nav>
  )
}
