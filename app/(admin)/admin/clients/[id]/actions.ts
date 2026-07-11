'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/dal/session'
import { requirePermission } from '@/lib/auth/permissions'
import { updateClient } from '@/lib/dal/clients'
import { assignTeamToClient, unassignTeamFromClient } from '@/lib/dal/team'

const UpdateSchema = z.object({
  companyName: z.string().min(1).max(120).optional(),
  contactName: z.string().min(1).max(120).optional(),
  projectBrief: z.string().max(2000).optional(),
  budget: z.string().max(200).optional(),
  timeline: z.string().max(200).optional(),
})

export type UpdateClientState =
  | undefined
  | { error: string }
  | { success: true }

export async function updateClientAction(
  clientId: string,
  _prev: UpdateClientState,
  formData: FormData,
): Promise<UpdateClientState> {
  const user = await requirePermission('client:update')

  const parsed = UpdateSchema.safeParse({
    companyName: formData.get('companyName') || undefined,
    contactName: formData.get('contactName') || undefined,
    projectBrief: formData.get('projectBrief') || undefined,
    budget: formData.get('budget') || undefined,
    timeline: formData.get('timeline') || undefined,
  })

  if (!parsed.success) return { error: 'Please fill all fields correctly.' }

  try {
    await updateClient(clientId, parsed.data)

    const { writeAudit } = await import('@/lib/audit')
    await writeAudit({
      action: 'CLIENT_UPDATED',
      userId: user.id,
      resource: 'Client',
      resourceId: clientId,
    })

    revalidatePath(`/admin/clients/${clientId}`)
    return { success: true }
  } catch (err) {
    console.error('[clients] update failed:', err)
    return { error: 'Failed to update client. Please try again.' }
  }
}

export async function assignTeamMemberAction(formData: FormData): Promise<void> {
  const user = await requireRole('SUPER_ADMIN')
  const clientId = formData.get('clientId') as string
  const teamMemberId = formData.get('teamMemberId') as string
  if (!clientId || !teamMemberId) return

  await assignTeamToClient({ clientId, teamMemberId })

  const { writeAudit } = await import('@/lib/audit')
  await writeAudit({
    action: 'TEAM_ASSIGNMENT_CREATED',
    userId: user.id,
    resource: 'TeamAssignment',
    resourceId: `${teamMemberId}_${clientId}`,
  })

  revalidatePath(`/admin/clients/${clientId}`)
}

export async function unassignTeamMemberAction(teamMemberId: string, clientId: string): Promise<void> {
  const user = await requireRole('SUPER_ADMIN')

  await unassignTeamFromClient({ teamMemberId, clientId })

  const { writeAudit } = await import('@/lib/audit')
  await writeAudit({
    action: 'TEAM_ASSIGNMENT_DELETED',
    userId: user.id,
    resource: 'TeamAssignment',
    resourceId: `${teamMemberId}_${clientId}`,
  })

  revalidatePath(`/admin/clients/${clientId}`)
}
