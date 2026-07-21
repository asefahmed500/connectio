import { notFound } from 'next/navigation'
import { getInviteForRegistration } from '@/lib/dal/invites'
import { getNumberSetting } from '@/lib/dal/settings'
import { RegisterForm } from './register-form'

export const metadata = { title: 'Set up your account — ClientConnect' }

export default async function InvitePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const invite = await getInviteForRegistration(slug)
  if (!invite) notFound()

  const minLength = await getNumberSetting('passwordMinLength')

  return (
    <div className="min-h-screen grid place-items-center bg-muted/30 px-4 py-12">
      <div className="w-full max-w-md flex flex-col gap-6">
        <div className="flex flex-col gap-2 text-center">
          <h1 className="text-3xl font-heading tracking-wide">Welcome to ClientConnect</h1>
          <p className="text-sm text-muted-foreground">
            You&apos;ve been invited to set up an account for{' '}
            <span className="font-medium text-foreground">{invite.companyName}</span>.
          </p>
        </div>
        <RegisterForm invite={invite} minLength={minLength} />
      </div>
    </div>
  )
}
