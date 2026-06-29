'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/dal/session'
import { assignTeamToClient, unassignTeamFromClient } from '@/lib/dal/team'

const AssignSchema = z.object({
  clientId: z.string().cuid(),
  teamMemberId: z.string().cuid(),
})

export async function assignAction(formData: FormData) {
  await requireRole('SUPER_ADMIN')
  const parsed = AssignSchema.safeParse({
    clientId: formData.get('clientId'),
    teamMemberId: formData.get('teamMemberId'),
  })
  if (!parsed.success) throw new Error('Invalid input')
  await assignTeamToClient(parsed.data)
  revalidatePath(`/admin/team/${parsed.data.teamMemberId}`)
  revalidatePath(`/admin/clients/${parsed.data.clientId}`)
}

export async function unassignAction(teamMemberId: string, clientId: string) {
  await requireRole('SUPER_ADMIN')
  const parsed = AssignSchema.safeParse({ clientId, teamMemberId })
  if (!parsed.success) throw new Error('Invalid input')
  await unassignTeamFromClient(parsed.data)
  revalidatePath(`/admin/team/${parsed.data.teamMemberId}`)
  revalidatePath(`/admin/clients/${parsed.data.clientId}`)
}
