'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { assignTeamToClient, unassignTeamFromClient } from '@/lib/dal/team'

const AssignSchema = z.object({
  clientId: z.string().cuid(),
  teamMemberId: z.string().cuid(),
})

export async function assignTeamMemberAction(formData: FormData) {
  const parsed = AssignSchema.safeParse({
    clientId: formData.get('clientId'),
    teamMemberId: formData.get('teamMemberId'),
  })
  if (!parsed.success) throw new Error('Invalid input')

  await assignTeamToClient({
    clientId: parsed.data.clientId,
    teamMemberId: parsed.data.teamMemberId,
  })

  revalidatePath(`/admin/clients/${parsed.data.clientId}`)
}

export async function unassignTeamMemberAction(teamMemberId: string, clientId: string) {
  const parsed = AssignSchema.safeParse({ clientId, teamMemberId })
  if (!parsed.success) throw new Error('Invalid input')

  await unassignTeamFromClient({
    clientId: parsed.data.clientId,
    teamMemberId: parsed.data.teamMemberId,
  })

  revalidatePath(`/admin/clients/${parsed.data.clientId}`)
}
