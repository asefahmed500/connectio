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
import { forgotPasswordAction, type ForgotPasswordState } from './actions'

const schema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
})

type Schema = z.infer<typeof schema>

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState<ForgotPasswordState, FormData>(
    forgotPasswordAction,
    undefined,
  )

  const { register, formState: { errors } } = useForm<Schema>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
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
        <h2 className="text-lg font-semibold">Check your email</h2>
        <p className="text-sm text-muted-foreground">
          If an account with that email exists, we&apos;ve sent a password reset link.
        </p>
        <p className="text-xs text-muted-foreground">
          <Link href="/login" className="underline hover:text-foreground">
            Back to sign in
          </Link>
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
        <p className="text-sm text-muted-foreground">
          Enter your email and we&apos;ll send you a reset link.
        </p>
      </div>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <Field data-invalid={!!errors.email}>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            aria-invalid={!!errors.email}
            {...register('email')}
          />
          {errors.email && <FieldError errors={[errors.email]} />}
        </Field>
        {state && 'error' in state && (
          <p className="text-sm text-destructive" role="alert">{state.error}</p>
        )}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? 'Sending…' : 'Send reset link'}
        </Button>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="underline hover:text-foreground">
          Back to sign in
        </Link>
      </p>
    </div>
  )
}
