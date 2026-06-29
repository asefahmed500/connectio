'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requireClientAccessBySlug } from '@/lib/dal/session'
import { deleteFile } from '@/lib/dal/files'

export async function deleteFileAction(fileId: string) {
  try {
    const parsed = z.string().cuid().safeParse(fileId)
    if (!parsed.success) throw new Error('Invalid file ID')

    await deleteFile(parsed.data)
    revalidatePath('/dashboard/visitor/', 'page')
  } catch (err) {
    console.error('[files] deleteFileAction failed:', err)
    throw new Error('Failed to delete file')
  }
}
