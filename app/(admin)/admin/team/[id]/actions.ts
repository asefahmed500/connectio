'use server'

import { z } from 'zod'
import { assignTeamToClient, unassignTeamFromClient } from '@/lib/dal/team'

const AssignSchema = z.object({
  teamMemberId: z.string().cuid(),
  clientId: z.string().cuid(),
})

export async function assignAction(formData: FormData): Promise<void> {
  const parsed = AssignSchema.safeParse({
    teamMemberId: formData.get('teamMemberId'),
    clientId: formData.get('clientId'),
  })
  if (!parsed.success) throw new Error('Invalid input')
  await assignTeamToClient(parsed.data)
}

export async function unassignAction(
  teamMemberId: string,
  clientId: string,
): Promise<void> {
  await unassignTeamFromClient({ teamMemberId, clientId })
}
