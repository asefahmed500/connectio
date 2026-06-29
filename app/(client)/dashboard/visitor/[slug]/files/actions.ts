'use server'

import { revalidatePath } from 'next/cache'
import { deleteFile } from '@/lib/dal/files'

export async function deleteFileAction(fileId: string) {
  try {
    await deleteFile(fileId)
    revalidatePath('/dashboard/visitor/', 'page')
  } catch (err) {
    console.error('[files] deleteFileAction failed:', err)
    throw err
  }
}
