'use client'

import { useCallback, startTransition, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useActionState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FieldLabel, FieldError } from '@/components/ui/field'
import { Card, CardContent } from '@/components/ui/card'
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp'
import {
  sendOtpAction,
  verifyOtpAction,
  completeResetAction,
  type ForgotPasswordState,
} from './actions'

const emailSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Enter a valid email address'),
})

type EmailSchema = z.infer<typeof emailSchema>

function EmailStep({
  state,
  onSubmit,
  pending,
}: {
  state: ForgotPasswordState
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  pending: boolean
}) {
  const { register, formState: { errors } } = useForm<EmailSchema>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: '' },
  })

  const err = state && 'error' in state ? (state as { error?: string }).error : undefined

  return (
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
      {err && (
        <p className="text-sm text-destructive flex items-start gap-1.5" role="alert">
          <svg className="size-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
          </svg>
          <span>{err}</span>
        </p>
      )}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Sending…' : 'Send verification code'}
      </Button>
    </form>
  )
}

function OtpStep({
  email,
  state,
  onSubmit,
  pending,
  onBack,
  onResend,
}: {
  email: string
  state: ForgotPasswordState
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  pending: boolean
  onBack: () => void
  onResend: () => void
}) {
  const [otpValue, setOtpValue] = useState('')

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="otp" value={otpValue} />
      <Field data-invalid={!!otpValue && otpValue.length !== 6}>
        <FieldLabel htmlFor="otp">Verification code</FieldLabel>
        <div className="flex justify-center py-2">
          <InputOTP
            id="otp"
            maxLength={6}
            pattern="\d{6}"
            value={otpValue}
            onChange={(v) => setOtpValue(v)}
            onComplete={() => {
              const form = document.getElementById('otp-form') as HTMLFormElement
              form?.requestSubmit()
            }}
          >
            <InputOTPGroup>
              {Array.from({ length: 6 }).map((_, i) => (
                <InputOTPSlot key={i} index={i} />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </div>  
        {otpValue && otpValue.length !== 6 && (
          <p className="text-sm text-destructive">Enter the complete 6-digit code</p>
        )}
      </Field>
      {state && 'error' in state && (
        <p className="text-sm text-destructive flex items-start gap-1.5" role="alert">
          <svg className="size-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
          </svg>
          <span>{(state as { error?: string }).error}</span>
        </p>
      )}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Verifying…' : 'Verify code'}
      </Button>
      <div className="flex items-center justify-between text-sm">
        <button
          type="button"
          onClick={onBack}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Different email
        </button>
        <button
          type="button"
          onClick={onResend}
          disabled={pending}
          className="text-primary underline-offset-2 hover:underline disabled:opacity-50"
        >
          Resend code
        </button>
      </div>
    </form>
  )
}

function ResetStep({
  minLength,
  state,
  onSubmit,
  pending,
}: {
  minLength: number
  state: ForgotPasswordState
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  pending: boolean
}) {
  const schema = useMemo(() => z.object({
    password: z.string().min(minLength, `Password must be at least ${minLength} characters`),
    confirm: z.string().min(1),
  }).refine((d) => d.password === d.confirm, {
    message: 'Passwords do not match',
    path: ['confirm'],
  }), [minLength])

  const { register, formState: { errors } } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirm: '' },
  })

  const err = state && 'error' in state ? (state as { error?: string }).error : undefined

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <Field data-invalid={!!errors.password}>
        <FieldLabel htmlFor="password">New password</FieldLabel>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          placeholder={`At least ${minLength} characters`}
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
      {err && (
        <p className="text-sm text-destructive flex items-start gap-1.5" role="alert">
          <svg className="size-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
          </svg>
          <span>{err}</span>
        </p>
      )}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Updating…' : 'Reset password'}
      </Button>
    </form>
  )
}

export function ForgotPasswordForm() {
  const [state, dispatch, pending] = useActionState<ForgotPasswordState, FormData>(
    async (prev, fd) => {
      const action = fd.get('_action')
      if (action === 'send_otp') return sendOtpAction(prev, fd)
      if (action === 'verify_otp') return verifyOtpAction(prev, fd)
      if (action === 'complete_reset') return completeResetAction(prev, fd)
      return prev
    },
    undefined,
  )

  const submitSendOtp = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    fd.set('_action', 'send_otp')
    startTransition(() => dispatch(fd))
  }, [dispatch])

  const submitVerifyOtp = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    fd.set('_action', 'verify_otp')
    startTransition(() => dispatch(fd))
  }, [dispatch])

  const submitCompleteReset = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    fd.set('_action', 'complete_reset')
    startTransition(() => dispatch(fd))
  }, [dispatch])

  const goBack = useCallback(() => {
    startTransition(() => dispatch(new FormData()))
  }, [dispatch])

  const resendOtp = useCallback(() => {
    if (!state || state === undefined || !('email' in state)) return
    const fd = new FormData()
    fd.set('email', (state as { email: string }).email)
    fd.set('_action', 'send_otp')
    startTransition(() => dispatch(fd))
  }, [dispatch, state])

  const step = state && 'step' in state ? (state as { step: string }).step : 'email'

  const emailValue = state && 'email' in state ? (state as { email: string }).email : ''

  return (
    <Card className="shadow-sm">
      <CardContent className="p-6 flex flex-col gap-5">
        {step === 'done' ? (
          <div className="p-2 text-center flex flex-col gap-4">
            <div className="rounded-full bg-emerald-100 size-12 mx-auto grid place-items-center">
              <svg className="size-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-semibold">Password updated</h2>
              <p className="text-sm text-muted-foreground">
                Your password has been changed. You can now sign in.
              </p>
            </div>
            <Button asChild className="mt-2">
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        ) : step === 'reset' ? (
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-semibold tracking-tight">Set new password</h1>
            <p className="text-sm text-muted-foreground">
              Choose a strong password for your account.
            </p>
            <ResetStep
              minLength={(state as { minLength: number }).minLength ?? 12}
              state={state}
              onSubmit={submitCompleteReset}
              pending={pending}
            />
          </div>
        ) : step === 'otp' ? (
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-semibold tracking-tight">Enter verification code</h1>
            <p className="text-sm text-muted-foreground">
              We sent a 6-digit code to <strong>{emailValue}</strong>
            </p>
            <OtpStep
              email={emailValue}
              state={state}
              onSubmit={submitVerifyOtp}
              pending={pending}
              onBack={goBack}
              onResend={resendOtp}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-semibold tracking-tight">Reset your password</h1>
            <p className="text-sm text-muted-foreground">
              Enter your email and we&apos;ll send you a verification code.
            </p>
            <EmailStep state={state} onSubmit={submitSendOtp} pending={pending} />
            <p className="text-center text-sm text-muted-foreground mt-3">
              <Link href="/login" className="font-medium text-primary underline-offset-2 hover:underline">
                Back to sign in
              </Link>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
