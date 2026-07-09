'use server'

import { revalidatePath } from 'next/cache'
import { verifyAuditChain } from '@/lib/dal/audit-chain'

export async function runChainVerificationAction(): Promise<void> {
  await verifyAuditChain()
  revalidatePath('/admin/audit-log/chain')
}
