'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FieldLabel, FieldError } from '@/components/ui/field'
import { Card, CardContent } from '@/components/ui/card'
import { createClientAction, type CreateClientState } from '../actions'
import Link from 'next/link'

const schema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
  name: z.string().min(1, 'Name is required').max(120),
  companyName: z.string().min(1, 'Company is required').max(120),
  contactName: z.string().min(1, 'Contact name is required').max(120),
})

type Schema = z.infer<typeof schema>

export function CreateClientForm() {
  const [state, action, pending] = useActionState<CreateClientState, FormData>(createClientAction, undefined)

  const { register, formState: { errors } } = useForm<Schema>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', name: '', companyName: '', contactName: '' },
  })

  if (state && 'success' in state) {
    return (
      <Card>
        <CardContent className="p-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-medium text-emerald-700">Account created</h2>
            <p className="text-sm text-muted-foreground">
              Credentials have been sent to <strong>{state.email}</strong>.
            </p>
          </div>
          <div className="flex gap-3">
            <Link href="/admin/clients/create">
              <Button variant="outline">Create another</Button>
            </Link>
            <Link href="/admin/clients">
              <Button>View all clients</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <form action={action} noValidate>
      <Card>
        <CardContent className="p-4 flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3">
            <Field data-invalid={!!errors.email}>
              <FieldLabel htmlFor="email">Email address</FieldLabel>
              <Input id="email" type="email" placeholder="jane@acme.com" aria-invalid={!!errors.email} {...register('email')} />
              {errors.email && <FieldError errors={[errors.email]} />}
            </Field>
            <Field data-invalid={!!errors.name}>
              <FieldLabel htmlFor="name">User name</FieldLabel>
              <Input id="name" placeholder="Jane Smith" aria-invalid={!!errors.name} {...register('name')} />
              {errors.name && <FieldError errors={[errors.name]} />}
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
          <Button type="submit" disabled={pending}>
            {pending ? 'Creating account…' : 'Create account & send credentials'}
          </Button>
        </CardContent>
      </Card>
    </form>
  )
}
