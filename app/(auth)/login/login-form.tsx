'use client'

import { useRef, useCallback, startTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useActionState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FieldLabel, FieldError } from '@/components/ui/field'
import { Card, CardContent } from '@/components/ui/card'
import { loginAction } from './actions'
import Link from 'next/link'

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
  password: z.string().min(1, 'Password is required'),
})

type Schema = z.infer<typeof schema>

export function LoginForm() {
  const search = useSearchParams()
  const next = search.get('next') ?? '/'
  const [state, action, pending] = useActionState(loginAction, undefined)
  const formRef = useRef<HTMLFormElement>(null)

  const { register, formState: { errors } } = useForm<Schema>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    fd.set('next', next)
    startTransition(() => action(fd))
  }, [action, next])

  return (
    <Card className="shadow-sm">
      <CardContent className="p-6 flex flex-col gap-5">
      <form ref={formRef} onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
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
        <Field data-invalid={!!errors.password}>
          <div className="flex items-center justify-between">
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <Link
              href="/reset-password"
              className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="Enter your password"
            aria-invalid={!!errors.password}
            {...register('password')}
          />
          {errors.password && <FieldError errors={[errors.password]} />}
        </Field>
        {state?.error && (
          <p className="text-sm text-destructive flex items-start gap-1.5" role="alert">
            <svg className="size-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
            </svg>
            <span>{state.error}</span>
          </p>
        )}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
        </CardContent>
      </Card>
  )
}
