'use server'

import { revalidatePath } from 'next/cache'
import { deleteFile } from '@/lib/dal/files'

export async function deleteFileAction(fileId: string): Promise<void> {
  await deleteFile(fileId)
  revalidatePath('/dashboard/visitor/', 'page')
}
