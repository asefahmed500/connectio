import { requireRole } from '@/lib/dal/session'
import {
  getPermissionsByDomain,
  getPermissionsForRole,
} from '@/lib/auth/permissions'
import type { Permission } from '@/lib/auth/permissions'
import type { UserRole } from '@prisma/client'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Check, Minus } from 'lucide-react'

export const metadata = { title: 'Roles & permissions — ClientConnect' }

const ROLES: UserRole[] = ['SUPER_ADMIN', 'TEAM_MEMBER', 'CLIENT']

const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: 'Super Admin',
  TEAM_MEMBER: 'Team Member',
  CLIENT: 'Client',
}

// Semantic Badge variants per role — primary (admin) / secondary (team) / outline (client).
// Avoids hardcoded color classes and `dark:` overrides (AGENTS.md forbids `dark:` in app code).
type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'ghost' | 'link'
const ROLE_VARIANT: Record<UserRole, BadgeVariant> = {
  SUPER_ADMIN: 'default',
  TEAM_MEMBER: 'secondary',
  CLIENT: 'outline',
}

export default async function AdminRolesPage() {
  await requireRole('SUPER_ADMIN')

  const domains = getPermissionsByDomain()
  const domainEntries = Object.entries(domains).sort(([a], [b]) => a.localeCompare(b))

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-heading tracking-wide">Roles & permissions</h1>
        <p className="text-sm text-muted-foreground">
          Permission matrix across all roles. Each role inherits the permissions listed below.
        </p>
      </div>

      <div className="flex items-center gap-3">
        {ROLES.map((role) => (
          <Badge key={role} variant={ROLE_VARIANT[role]}>
            {ROLE_LABELS[role]}
          </Badge>
        ))}
      </div>

      {domainEntries.map(([domain, perms]) => (
        <Card key={domain}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-heading tracking-wide capitalize">{domain}</CardTitle>
            <CardDescription className="text-xs">
              {perms.length} permission{perms.length !== 1 ? 's' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="text-left py-2 pr-4 font-medium">Permission</th>
                    {ROLES.map((role) => (
                      <th key={role} className="text-center py-2 px-2 font-medium min-w-[100px]">
                        {ROLE_LABELS[role]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {perms.map((perm) => (
                    <tr key={perm} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="py-2 pr-4">
                        <code className="text-xs font-mono">{perm}</code>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {getDescription(perm)}
                        </span>
                      </td>
                      {ROLES.map((role) => (
                        <td key={role} className="text-center py-2 px-2">
                          {hasPermission(role, perm) ? (
                            <Check className="inline-block w-4 h-4 text-emerald-600" />
                          ) : (
                            <Minus className="inline-block w-4 h-4 text-muted-foreground/40" />
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

const DESCRIPTION_MAP: Partial<Record<Permission, string>> = {
  'admin:dashboard': 'View the admin dashboard and analytics',
  'settings:read': 'View system settings',
  'settings:update': 'Modify system configuration',
  'backup:manage': 'Create and restore backups',
  'audit:read': 'View the audit log',
  'audit:verify': 'Verify audit chain integrity',
  'gdpr:manage': 'Manage GDPR erasure requests and data exports',
  'sso:manage': 'Configure SSO providers and SCIM API keys',
  'permissions:view': 'View the role-permission matrix',
  'user:read': 'List and search users',
  'user:create': 'Create new user accounts',
  'user:update': 'Edit user details and reset passwords',
  'user:delete': 'Soft-delete user accounts',
  'user:reset-password': 'Force-reset a user password',
  'user:block': 'Block or unblock users',
  'client:read': 'View client profiles and data',
  'client:create': 'Create new client accounts',
  'client:update': 'Edit client details',
  'client:delete': 'Soft-delete client accounts',
  'client:assign-team': 'Assign team members to clients',
  'form:read': 'View forms and their schemas',
  'form:create': 'Create new forms',
  'form:update': 'Edit form schema and settings',
  'form:delete': 'Soft-delete forms',
  'submission:read': 'View submissions',
  'submission:create': 'Create new submissions',
  'submission:update': 'Edit existing submissions',
  'submission:review': 'Review, approve, or reject submissions',
  'submission:delete': 'Soft-delete submissions',
  'comment:read': 'View comments',
  'comment:create': 'Post comments',
  'comment:delete': 'Delete comments',
  'file:read': 'View uploaded files',
  'file:upload': 'Upload new files',
  'file:delete': 'Delete uploaded files',
  'team:read': 'View team members and assignments',
  'team:manage': 'Create, edit, and remove team members and assignments',
  'invite:read': 'View invite links',
  'invite:create': 'Create invite links',
  'invite:delete': 'Revoke invite links',
  'invite:use': 'Accept and redeem an invite',
  'notification:read': 'View notifications',
  'sso:use': 'Sign in via SSO',
  'profile:read': 'View own profile',
  'profile:update': 'Update own profile information',
  'profile:change-password': 'Change own password',
}

function getDescription(perm: Permission): string {
  return DESCRIPTION_MAP[perm] ?? ''
}

function hasPermission(role: UserRole, perm: Permission): boolean {
  const perms = getPermissionsForRole(role)
  return perms.includes(perm)
}
