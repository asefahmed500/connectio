'use client'

import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldLabel, FieldError } from '@/components/ui/field'
import { postCommentAction, type CommentFormState } from './actions'
import type { UserRole } from '@prisma/client'

const schema = z.object({
  message: z.string().min(1, 'Message is required').max(5000, 'Message exceeds 5000 characters'),
  isInternal: z.boolean().optional(),
})

type Schema = z.infer<typeof schema>

export function CommentForm({
  clientId,
  submissionId,
  viewerRole,
}: {
  clientId: string
  submissionId?: string
  viewerRole: UserRole
}) {
  const canMarkInternal = viewerRole === 'SUPER_ADMIN' || viewerRole === 'TEAM_MEMBER'
  const [state, action, pending] = useActionState<CommentFormState, FormData>(
    postCommentAction,
    undefined,
  )

  const { register, control, formState: { errors } } = useForm<Schema>({
    resolver: zodResolver(schema),
    defaultValues: { message: '', isInternal: false },
  })

  return (
    <form action={action} noValidate className="flex flex-col gap-3 pt-4 border-t">
      <input type="hidden" name="clientId" value={clientId} />
      {submissionId && <input type="hidden" name="submissionId" value={submissionId} />}
      <Field data-invalid={!!errors.message}>
        <FieldLabel htmlFor="message">New message</FieldLabel>
        <Textarea
          id="message"
          rows={4}
          placeholder="Write a message…"
          aria-invalid={!!errors.message}
          {...register('message')}
        />
        {errors.message && <FieldError errors={[errors.message]} />}
      </Field>
      {canMarkInternal && (
        <Controller
          name="isInternal"
          control={control}
          render={({ field }) => (
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={field.value} onCheckedChange={field.onChange} />
              <span>Internal (hidden from client)</span>
            </label>
          )}
        />
      )}
      {state && 'error' in state && <p className="text-sm text-destructive" role="alert">{state.error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? 'Posting…' : 'Post message'}
      </Button>
    </form>
  )
}
