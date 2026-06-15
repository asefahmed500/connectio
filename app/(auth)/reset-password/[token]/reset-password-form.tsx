'use client'

import { useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useActionState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FieldLabel, FieldError } from '@/components/ui/field'
import { resetPasswordAction, type ResetPasswordState } from './actions'

const schema = z.object({
  password: z.string().min(12, 'Password must be at least 12 characters'),
  confirm: z.string().min(1),
}).refine((d) => d.password === d.confirm, {
  message: 'Passwords do not match',
  path: ['confirm'],
})

type Schema = z.infer<typeof schema>

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<ResetPasswordState, FormData>(
    resetPasswordAction.bind(null, token),
    undefined,
  )

  const { register, formState: { errors } } = useForm<Schema>({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirm: '' },
  })

  const onSubmit = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    action(new FormData(e.currentTarget))
  }, [action])

  if (state && 'success' in state) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <div className="rounded-full bg-emerald-100 dark:bg-emerald-900/30 size-12 mx-auto grid place-items-center">
          <svg className="size-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold">Password updated</h2>
        <p className="text-sm text-muted-foreground">
          Your password has been changed. You can now sign in.
        </p>
        <Button asChild className="mt-2">
          <Link href="/login">Sign in</Link>
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Set new password</h1>
        <p className="text-sm text-muted-foreground">
          Choose a strong password for your account.
        </p>
      </div>
      <Field data-invalid={!!errors.password}>
        <FieldLabel htmlFor="password">New password</FieldLabel>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 12 characters"
          aria-invalid={!!errors.password}
          {...register('password')}
        />
        {errors.password && <FieldError errors={[errors.password]} />}
      </Field>
      <Field data-invalid={!!errors.confirm}>
        <FieldLabel htmlFor="confirm">Confirm password</FieldLabel>
        <Input
          id="confirm"
          type="password"
          autoComplete="new-password"
          placeholder="Re-enter your password"
          aria-invalid={!!errors.confirm}
          {...register('confirm')}
        />
        {errors.confirm && <FieldError errors={[errors.confirm]} />}
      </Field>
      {state && 'error' in state && (
        <p className="text-sm text-destructive" role="alert">{state.error}</p>
      )}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Updating…' : 'Reset password'}
      </Button>
    </form>
  )
}
