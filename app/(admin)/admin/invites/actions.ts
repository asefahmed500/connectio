'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/dal/session'
import { createInvite, resendInvite } from '@/lib/dal/invites'
import { prisma } from '@/lib/db'
import { writeAudit } from '@/lib/audit'

const CreateSchema = z.object({
  email: z.email(),
  companyName: z.string().min(1).max(120),
  contactName: z.string().min(1).max(120),
})

export type CreateInviteState =
  | undefined
  | { error: string }
  | { success: true; slug: string; inviteLink: string }

export async function createInviteAction(
  _prev: CreateInviteState,
  formData: FormData,
): Promise<CreateInviteState> {
  const user = await requireRole('SUPER_ADMIN')
  const parsed = CreateSchema.safeParse({
    email: formData.get('email'),
    companyName: formData.get('companyName'),
    contactName: formData.get('contactName'),
  })
  if (!parsed.success) return { error: 'Please fill all fields correctly.' }

  try {
    const invite = await createInvite({ ...parsed.data, createdBy: user.id })

    const { writeAudit } = await import('@/lib/audit')
    await writeAudit({
      action: 'INVITE_CREATED',
      userId: user.id,
      resource: 'Invite',
      resourceId: invite.id,
    })

    revalidatePath('/admin/invites')
    const base = process.env.NEXT_PUBLIC_APP_URL ?? ''
    const inviteLink = `${base}/invite/${invite.slug}`

    try {
      const { sendEmail } = await import('@/lib/email')
      const { renderInviteEmail } = await import('@/lib/email-templates')
      const tpl = await renderInviteEmail({
        contactName: parsed.data.contactName,
        companyName: parsed.data.companyName,
        inviteUrl: inviteLink,
      })
      await sendEmail({ to: parsed.data.email, subject: tpl.subject, text: tpl.text, html: tpl.html })
    } catch (err) {
      console.error('[invites] Failed to send invite email:', err)
    }

    return { success: true, slug: invite.slug, inviteLink }
  } catch (err) {
    console.error('[invites] createInvite failed:', err)
    return { error: 'Failed to create invite. Please try again.' }
  }
}

export async function resendInviteAction(slug: string): Promise<void> {
  await requireRole('SUPER_ADMIN')
  const invite = await prisma.invite.findUnique({ where: { slug } })
  if (!invite || invite.status !== 'OPEN') return

  try {
    await resendInvite({
      slug: invite.slug,
      contactName: invite.contactName,
      companyName: invite.companyName,
      email: invite.email,
    })

    const { writeAudit } = await import('@/lib/audit')
    await writeAudit({
      action: 'INVITE_RESENT',
      userId: (await requireRole('SUPER_ADMIN')).id,
      resource: 'Invite',
      resourceId: invite.id,
    })
  } catch (err) {
    console.error('[invites] resendInvite failed:', err)
  }
}

export async function revokeInviteAction(slug: string): Promise<void> {
  const user = await requireRole('SUPER_ADMIN')
  try {
    const invite = await prisma.invite.findUnique({ where: { slug } })
    if (!invite) return
    if (invite.status !== 'OPEN') return

    await prisma.invite.update({
      where: { id: invite.id },
      data: { status: 'REVOKED' },
    })

    const { writeAudit } = await import('@/lib/audit')
    await writeAudit({
      action: 'INVITE_REVOKED',
      userId: user.id,
      resource: 'Invite',
      resourceId: invite.id,
    })

    revalidatePath('/admin/invites')
  } catch (err) {
    console.error('[invites] revokeInvite failed:', err)
  }
}
