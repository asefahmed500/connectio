'use client'

import { useState } from 'react'
import { useActionState } from 'react'
import Link from 'next/link'
import { verifyTwoFactorAction, type TwoFactorState } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp'

export function TwoFactorForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState<TwoFactorState, FormData>(
    verifyTwoFactorAction,
    undefined,
  )
  const [mode, setMode] = useState<'totp' | 'backup'>('totp')

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {next && <input type="hidden" name="next" value={next} />}

      {mode === 'totp' ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="code" className="text-sm font-medium">
            Enter the 6-digit code from your authenticator app
          </label>
          <InputOTP name="code" maxLength={6} containerClassName="justify-center">
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
              <InputOTPSlot index={3} />
              <InputOTPSlot index={4} />
              <InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="backup-code" className="text-sm font-medium">
            Enter one of your 8-character backup codes
          </label>
          <Input
            id="backup-code"
            name="code"
            type="text"
            autoComplete="one-time-code"
            placeholder="abcd-1234"
            className="text-center text-lg tracking-widest"
            autoFocus
          />
        </div>
      )}

      {state?.error && (
        <p className="text-xs text-destructive text-center" role="alert">{state.error}</p>
      )}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Verifying…' : 'Verify'}
      </Button>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <Link href="/login" className="hover:text-foreground">
          Back to login
        </Link>
        <button
          type="button"
          className="hover:text-foreground underline underline-offset-2"
          onClick={() => setMode(mode === 'totp' ? 'backup' : 'totp')}
        >
          {mode === 'totp' ? 'Use a backup code' : 'Use authenticator app'}
        </button>
      </div>
    </form>
  )
}
