'use client'

import { useState, useActionState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Field, FieldError } from '@/components/ui/field'
import { postReplyAction } from './actions'

const schema = z.object({
  message: z.string().min(1, 'Message is required').max(5000, 'Message exceeds 5000 characters'),
})

type Schema = z.infer<typeof schema>

export function ReplyForm({
  parentId,
  clientId,
  submissionId,
}: {
  parentId: string
  clientId: string
  submissionId?: string
}) {
  const [open, setOpen] = useState(false)
  const [state, action, pending] = useActionState(postReplyAction, undefined)

  const { register, formState: { errors } } = useForm<Schema>({
    resolver: zodResolver(schema),
    defaultValues: { message: '' },
  })

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-muted-foreground hover:text-foreground mt-2"
      >
        Reply
      </button>
    )
  }

  return (
    <form action={action} noValidate className="mt-3 flex flex-col gap-2">
      <input type="hidden" name="parentId" value={parentId} />
      <input type="hidden" name="clientId" value={clientId} />
      {submissionId && <input type="hidden" name="submissionId" value={submissionId} />}
      <Field data-invalid={!!errors.message}>
        <Textarea
          rows={3}
          placeholder="Write a reply…"
          aria-invalid={!!errors.message}
          {...register('message')}
        />
        {errors.message && <FieldError errors={[errors.message]} />}
      </Field>
      {state && 'error' in state && <p className="text-sm text-destructive" role="alert">{state.error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? 'Posting…' : 'Post reply'}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setOpen(false)}
          disabled={pending}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}
