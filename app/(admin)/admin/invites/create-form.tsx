'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FieldLabel, FieldError } from '@/components/ui/field'
import { Card, CardContent } from '@/components/ui/card'
import { createInviteAction } from './actions'

const schema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
  companyName: z.string().min(1, 'Company is required').max(120),
  contactName: z.string().min(1, 'Contact name is required').max(120),
})

type Schema = z.infer<typeof schema>

export function CreateInviteForm() {
  const [state, action, pending] = useActionState(createInviteAction, undefined)

  const { register, formState: { errors } } = useForm<Schema>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', companyName: '', contactName: '' },
  })

  return (
    <form action={action} noValidate>
      <Card>
        <CardContent className="p-4 flex flex-col gap-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field data-invalid={!!errors.email}>
          <FieldLabel htmlFor="email">Client email</FieldLabel>
          <Input id="email" type="email" placeholder="jane@acme.com" aria-invalid={!!errors.email} {...register('email')} />
          {errors.email && <FieldError errors={[errors.email]} />}
        </Field>
        <Field data-invalid={!!errors.companyName}>
          <FieldLabel htmlFor="companyName">Company</FieldLabel>
          <Input id="companyName" placeholder="Acme Corp" aria-invalid={!!errors.companyName} {...register('companyName')} />
          {errors.companyName && <FieldError errors={[errors.companyName]} />}
        </Field>
        <Field data-invalid={!!errors.contactName}>
          <FieldLabel htmlFor="contactName">Contact name</FieldLabel>
          <Input id="contactName" placeholder="Jane Smith" aria-invalid={!!errors.contactName} {...register('contactName')} />
          {errors.contactName && <FieldError errors={[errors.contactName]} />}
        </Field>
      </div>
      {state && 'error' in state && <p className="text-sm text-destructive" role="alert">{state.error}</p>}
      {state && 'success' in state && (
        <div className="text-sm flex flex-col gap-1 bg-muted/50 rounded p-3">
          <div className="font-medium text-emerald-700">Invite created</div>
          <div>
            Share this link with the client:{' '}
            <code className="font-mono text-xs break-all">{state.inviteLink}</code>
          </div>
        </div>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? 'Creating…' : 'Create invite'}
      </Button>
        </CardContent>
      </Card>
    </form>
  )
}
