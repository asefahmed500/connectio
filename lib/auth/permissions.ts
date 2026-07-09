import 'server-only'
import { getCurrentUser } from '@/lib/dal/session'
import { forbidden } from 'next/navigation'
import type { UserRole } from '@prisma/client'

// ─────────────────────────────────────────────────────────────────────
// Permission definitions
// ─────────────────────────────────────────────────────────────────────

export const PERMISSIONS = {
  // Admin / system
  'admin:dashboard': 'Access the admin dashboard',
  'settings:read': 'View system settings',
  'settings:update': 'Update system settings',
  'settings:manage': 'Manage webhooks and integrations',
  'backup:manage': 'Create and restore backups',
  'audit:read': 'View audit log',
  'audit:verify': 'Verify audit chain integrity',
  'gdpr:manage': 'Manage GDPR erasure requests and data exports',
  'sso:manage': 'Configure SSO providers and SCIM API keys',
  'permissions:view': 'View role-permission matrix',

  // User management
  'user:read': 'View users',
  'user:create': 'Create users',
  'user:update': 'Edit user details',
  'user:delete': 'Delete users',
  'user:reset-password': 'Reset user passwords',
  'user:block': 'Block/unblock users',

  // Client management
  'client:read': 'View clients',
  'client:create': 'Create clients',
  'client:update': 'Edit client details',
  'client:delete': 'Delete clients',
  'client:assign-team': 'Assign team members to clients',

  // Form management
  'form:read': 'View forms',
  'form:create': 'Create forms',
  'form:update': 'Edit forms',
  'form:delete': 'Delete forms',

  // Submission management
  'submission:read': 'View submissions',
  'submission:create': 'Create submissions',
  'submission:update': 'Edit submissions',
  'submission:review': 'Review and approve/reject submissions',
  'submission:delete': 'Delete submissions',

  // Comment management
  'comment:read': 'View comments',
  'comment:create': 'Create comments',
  'comment:delete': 'Delete comments',

  // File management
  'file:read': 'View files',
  'file:upload': 'Upload files',
  'file:delete': 'Delete files',

  // Team management
  'team:read': 'View team members',
  'team:manage': 'Manage team members and assignments',

  // Invite management
  'invite:read': 'View invites',
  'invite:create': 'Create invites',
  'invite:delete': 'Delete invites',
  'invite:use': 'Accept and use invite links',

  // Notifications
  'notification:read': 'View notifications',

  // SSO
  'sso:use': 'Sign in via SSO',

  // Own profile
  'profile:read': 'View own profile',
  'profile:update': 'Update own profile',
  'profile:change-password': 'Change own password',
} as const

export type Permission = keyof typeof PERMISSIONS

// ─────────────────────────────────────────────────────────────────────
// Role → permission mapping
// ─────────────────────────────────────────────────────────────────────

const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  SUPER_ADMIN: [
    'admin:dashboard',
    'settings:read',
    'settings:update',
    'settings:manage',
    'backup:manage',
    'audit:read',
    'audit:verify',
    'gdpr:manage',
    'sso:manage',
    'permissions:view',
    'user:read',
    'user:create',
    'user:update',
    'user:delete',
    'user:reset-password',
    'user:block',
    'client:read',
    'client:create',
    'client:update',
    'client:delete',
    'client:assign-team',
    'form:read',
    'form:create',
    'form:update',
    'form:delete',
    'submission:read',
    'submission:create',
    'submission:update',
    'submission:review',
    'submission:delete',
    'comment:read',
    'comment:create',
    'comment:delete',
    'file:read',
    'file:upload',
    'file:delete',
    'team:read',
    'team:manage',
    'invite:read',
    'invite:create',
    'invite:delete',
    'notification:read',
    'profile:read',
    'profile:update',
    'profile:change-password',
  ],

  TEAM_MEMBER: [
    'client:read',
    'form:read',
    'submission:read',
    'submission:create',
    'submission:update',
    'submission:review',
    'comment:read',
    'comment:create',
    'file:read',
    'file:upload',
    'team:read',
    'notification:read',
    'profile:read',
    'profile:update',
    'profile:change-password',
    'invite:use',
  ],

  CLIENT: [
    'submission:read',
    'submission:create',
    'submission:update',
    'comment:read',
    'comment:create',
    'file:read',
    'file:upload',
    'form:read',
    'notification:read',
    'profile:read',
    'profile:update',
    'profile:change-password',
    'invite:use',
  ],
}

// ─────────────────────────────────────────────────────────────────────
// Guards
// ─────────────────────────────────────────────────────────────────────

/**
 * Check if the current user has a specific permission.
 * Returns true/false — does not throw.
 */
export async function checkPermission(
  permission: Permission,
): Promise<boolean> {
  const user = await getCurrentUser()
  if (!user) return false
  return ROLE_PERMISSIONS[user.role]?.includes(permission) ?? false
}

/**
 * Require the current user to have a specific permission.
 * Throws `forbidden()` (renders the forbidden page) if not.
 * Returns the current user if permitted.
 */
export async function requirePermission(permission: Permission) {
  const user = await getCurrentUser()
  if (!user) {
    const { redirect } = await import('next/navigation')
    redirect('/login')
    return undefined as never
  }
  if (!ROLE_PERMISSIONS[user.role]?.includes(permission)) {
    forbidden()
  }
  return user
}

/**
 * Get all permissions for a given role.
 */
export function getPermissionsForRole(role: UserRole): readonly Permission[] {
  return ROLE_PERMISSIONS[role] ?? []
}

/**
 * Group permissions by domain prefix for display.
 */
export function getPermissionsByDomain(): Record<string, Permission[]> {
  const domains: Record<string, Permission[]> = {}
  for (const perm of Object.keys(PERMISSIONS) as Permission[]) {
    const domain = perm.split(':')[0] ?? 'other'
    if (!domains[domain]) domains[domain] = []
    domains[domain].push(perm)
  }
  return domains
}
