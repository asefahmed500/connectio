'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FieldLabel, FieldError } from '@/components/ui/field'
import { Card, CardContent } from '@/components/ui/card'
import { updateUserAction, type UserActionState } from '../actions'
import type { UserRole } from '@prisma/client'

const schema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  role: z.enum(['SUPER_ADMIN', 'TEAM_MEMBER', 'CLIENT']),
})

export function UserEditForm({ user }: { user: { id: string; name: string; email: string; role: UserRole } }) {
  const [state, action, pending] = useActionState<UserActionState, FormData>(updateUserAction, undefined)
  const { register, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: user.name, email: user.email, role: user.role },
  })

  return (
    <form action={action} noValidate>
      <Card>
        <CardContent className="p-4 flex flex-col gap-3">
          <input type="hidden" name="userId" value={user.id} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field data-invalid={!!errors.name}>
              <FieldLabel htmlFor="name">Name</FieldLabel>
              <Input id="name" aria-invalid={!!errors.name} {...register('name')} />
              {errors.name && <FieldError errors={[errors.name]} />}
            </Field>
            <Field data-invalid={!!errors.email}>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input id="email" type="email" aria-invalid={!!errors.email} {...register('email')} />
              {errors.email && <FieldError errors={[errors.email]} />}
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="role">Role</FieldLabel>
            <select id="role" {...register('role')} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
              <option value="SUPER_ADMIN">Super Admin</option>
              <option value="TEAM_MEMBER">Team Member</option>
              <option value="CLIENT">Client</option>
            </select>
          </Field>
          {state && 'error' in state && <p className="text-sm text-destructive" role="alert">{state.error}</p>}
          {state && 'success' in state && !state.password && (
            <p className="text-sm text-emerald-700">User updated successfully.</p>
          )}
          <Button type="submit" disabled={pending}>
            {pending ? 'Saving…' : 'Save changes'}
          </Button>
        </CardContent>
      </Card>
    </form>
  )
}
