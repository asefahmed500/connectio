'use client'

import { useFormStatus } from 'react-dom'
import { rotateSecretAction, testWebhookAction } from '../actions'
import { Button } from '@/components/ui/button'
import { RotateCcw, Play } from 'lucide-react'

function RotateButton() {
  const { pending } = useFormStatus()
  return (
    <Button variant="outline" size="sm" type="submit" disabled={pending}>
      <RotateCcw className="w-3 h-3 mr-1" />
      {pending ? 'Rotating…' : 'Rotate secret'}
    </Button>
  )
}

function TestButton() {
  const { pending } = useFormStatus()
  return (
    <Button variant="outline" size="sm" type="submit" disabled={pending}>
      <Play className="w-3 h-3 mr-1" />
      {pending ? 'Testing…' : 'Test'}
    </Button>
  )
}

export function WebhookDetailActions({ webhookId }: { webhookId: string }) {
  return (
    <div className="flex items-center gap-2">
      <form
        action={async () => {
          const result = await testWebhookAction(webhookId)
          alert(result.status ? `Status: ${result.status}` : `Error: ${result.error}`)
        }}
      >
        <TestButton />
      </form>
      <form action={rotateSecretAction.bind(null, webhookId)}>
        <RotateButton />
      </form>
    </div>
  )
}
