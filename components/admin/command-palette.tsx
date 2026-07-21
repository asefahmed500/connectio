'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  LayoutDashboard,
  Users,
  Mail,
  Building2,
  FileText,
  UsersRound,
  Bell,
  Settings,
  ScrollText,
  Fingerprint,
  ShieldCheck,
  Scale,
  Shield,
  Cable,
  Scroll,
  Gauge,
  Key,
  Search,
  MessageSquare,
  MonitorSmartphone,
} from 'lucide-react'

const PAGES = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, keywords: 'home overview stats' },
  { href: '/admin/users', label: 'Users', icon: Users, keywords: 'people accounts team members' },
  { href: '/admin/invites', label: 'Invites', icon: Mail, keywords: 'invitations links' },
  { href: '/admin/clients', label: 'Clients', icon: Building2, keywords: 'companies customers' },
  { href: '/admin/forms', label: 'Forms', icon: FileText, keywords: 'templates fields schema' },
  { href: '/admin/team', label: 'Team', icon: UsersRound, keywords: 'staff employees' },
  { href: '/admin/comments', label: 'Comments', icon: MessageSquare, keywords: 'messages moderation chat' },
  { href: '/admin/sessions', label: 'Active Sessions', icon: MonitorSmartphone, keywords: 'login devices logout revoke' },
  { href: '/admin/notifications', label: 'Notifications', icon: Bell, keywords: 'alerts updates' },
  { href: '/admin/audit-log', label: 'Audit Log', icon: ScrollText, keywords: 'history changes activity' },
  { href: '/admin/audit-log/chain', label: 'Audit Chain', icon: ShieldCheck, keywords: 'integrity verify hash tamper' },
  { href: '/admin/gdpr', label: 'GDPR', icon: Scale, keywords: 'privacy erasure data export' },
  { href: '/admin/roles', label: 'Roles', icon: Shield, keywords: 'permissions rbac access control' },
  { href: '/admin/search', label: 'Search', icon: Search, keywords: 'find global lookup' },
  { href: '/admin/webhooks', label: 'Webhooks', icon: Cable, keywords: 'webhook event forwarding endpoint' },
  { href: '/admin/email-logs', label: 'Email Logs', icon: Mail, keywords: 'email delivery history transactional' },
  { href: '/admin/email-templates', label: 'Email Templates', icon: Scroll, keywords: 'email content customize' },
  { href: '/admin/rate-limits', label: 'Rate Limits', icon: Gauge, keywords: 'rate limit throttle abuse' },
  { href: '/admin/api-keys', label: 'API Keys', icon: Key, keywords: 'api token integration programmatic' },
  { href: '/admin/sso', label: 'SSO', icon: Fingerprint, keywords: 'single sign on saml oidc identity' },
  { href: '/admin/settings', label: 'Settings', icon: Settings, keywords: 'config configuration maintenance' },
]

export function CommandPalette() {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  const run = useCallback((href: string) => {
    setOpen(false)
    router.push(href)
  }, [router])

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search pages…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Pages">
          {PAGES.map((p) => (
            <CommandItem key={p.href} onSelect={() => run(p.href)}>
              <p.icon className="mr-2 h-4 w-4" />
              <span>{p.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
