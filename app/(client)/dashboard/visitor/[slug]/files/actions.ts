'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { deleteFile } from '@/lib/dal/files'

export async function deleteFileAction(fileId: string): Promise<void> {
  const parsed = z.string().cuid().safeParse(fileId)
  if (!parsed.success) return

  try {
    await deleteFile(fileId)
    revalidatePath('/dashboard/visitor/', 'page')
  } catch (err) {
    console.error('[files] deleteFileAction failed:', err)
  }
}
