'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FieldLabel, FieldError } from '@/components/ui/field'
import { addTeamMemberAction, type AddTeamMemberState } from './actions'

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(120),
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
  password: z
    .string()
    .min(12, 'Password must be at least 12 characters')
    .regex(/[A-Za-z]/, 'Include at least one letter')
    .regex(/\d/, 'Include at least one number')
    .regex(/[^A-Za-z0-9]/, 'Include at least one symbol'),
  department: z.string().max(80).optional(),
})

type Schema = z.infer<typeof schema>

export function AddTeamMemberForm() {
  const [state, action, pending] = useActionState<AddTeamMemberState, FormData>(
    addTeamMemberAction,
    undefined,
  )

  const { register, formState: { errors } } = useForm<Schema>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', password: '', department: '' },
  })

  return (
    <form action={action} noValidate className="border rounded-lg p-4 flex flex-col gap-3">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Field data-invalid={!!errors.name}>
          <FieldLabel htmlFor="name">Full name</FieldLabel>
          <Input id="name" maxLength={120} aria-invalid={!!errors.name} {...register('name')} />
          {errors.name && <FieldError errors={[errors.name]} />}
        </Field>
        <Field data-invalid={!!errors.email}>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input id="email" type="email" aria-invalid={!!errors.email} {...register('email')} />
          {errors.email && <FieldError errors={[errors.email]} />}
        </Field>
        <Field data-invalid={!!errors.password}>
          <FieldLabel htmlFor="password">Temp password</FieldLabel>
          <Input id="password" type="password" aria-invalid={!!errors.password} {...register('password')} />
          {errors.password && <FieldError errors={[errors.password]} />}
        </Field>
        <Field>
          <FieldLabel htmlFor="department">Department (optional)</FieldLabel>
          <Input id="department" maxLength={80} {...register('department')} />
        </Field>
      </div>
      <p className="text-xs text-muted-foreground">
        The team member signs in with this email + temporary password. They should change it after first login.
      </p>
      {state && 'error' in state && <p className="text-sm text-destructive" role="alert">{state.error}</p>}
      {state && 'fields' in state && state.fields && (
        <ul className="text-sm text-destructive list-disc pl-5 flex flex-col gap-1" role="alert">
          {Object.entries(state.fields).map(([k, v]) => (
            <li key={k}><code>{k}</code>: {(v as string[]).join(' ')}</li>
          ))}
        </ul>
      )}
      {state && 'success' in state && (
        <p className="text-sm text-emerald-700 dark:text-emerald-400">Team member created.</p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? 'Creating…' : 'Add team member'}
      </Button>
    </form>
  )
}
