'use server'

import { assignTeamToClient, unassignTeamFromClient } from '@/lib/dal/team'

export async function assignTeamMemberAction(formData: FormData): Promise<void> {
  const teamMemberId = formData.get('teamMemberId')
  const clientId = formData.get('clientId')
  if (typeof teamMemberId !== 'string' || typeof clientId !== 'string') throw new Error('Invalid input')
  await assignTeamToClient({ teamMemberId, clientId })
}

export async function unassignTeamMemberAction(
  teamMemberId: string,
  clientId: string,
): Promise<void> {
  try {
    await unassignTeamFromClient({ teamMemberId, clientId })
  } catch (err) {
    console.error('[clients] unassignTeamMemberAction failed:', err)
  }
}
