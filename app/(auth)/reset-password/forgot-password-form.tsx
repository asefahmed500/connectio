'use client'

import { useCallback, startTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useActionState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FieldLabel, FieldError } from '@/components/ui/field'
import { Card, CardContent } from '@/components/ui/card'
import { forgotPasswordAction, type ForgotPasswordState } from './actions'

const emailSchema = z
  .string()
  .min(1, 'Email is required')
  .email('Enter a valid email address')
  .refine((v) => {
    const domain = v.split('@')[1]
    return domain ? domain.includes('.') : true
  }, 'Enter a complete email address (e.g. name@company.com)')

const schema = z.object({
  email: emailSchema,
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
    startTransition(() => action(new FormData(e.currentTarget)))
  }, [action])

  if (state && 'success' in state) {
    return (
      <Card className="shadow-sm">
        <CardContent className="p-8 text-center flex flex-col gap-4">
        <div className="rounded-full bg-emerald-100 size-12 mx-auto grid place-items-center">
          <svg className="size-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">Check your email</h2>
          <p className="text-sm text-muted-foreground">
            If an account with that email exists, we&apos;ve sent a password reset link.
          </p>
        </div>
        <Link
          href="/login"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <svg className="size-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to sign in
        </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="shadow-sm">
      <CardContent className="p-6 flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">Reset your password</h1>
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
            placeholder="name@company.com"
            aria-invalid={!!errors.email}
            {...register('email')}
          />
          {errors.email && <FieldError errors={[errors.email]} />}
        </Field>
        {state && 'error' in state && (
          <p className="text-sm text-destructive flex items-start gap-1.5" role="alert">
            <svg className="size-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
            </svg>
            <span>{state.error}</span>
          </p>
        )}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? 'Sending…' : 'Send reset link'}
        </Button>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="font-medium text-primary underline-offset-2 hover:underline">
          Back to sign in
        </Link>
      </p>
        </CardContent>
      </Card>
  )
}
