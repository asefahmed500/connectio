'use client'

import { useState, useTransition } from 'react'
import { ShieldCheck, ShieldOff, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import {
  startEnrollmentAction,
  confirmEnrollmentAction,
  disableEnrollmentAction,
} from './two-factor-actions'

type Props = {
  enabled: boolean
}

export function TwoFactorSettings({ enabled }: Props) {
  const [pending, startTransition] = useTransition()
  const [setup, setSetup] = useState<{ secret: string; qr: string } | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null)
  const [showDisable, setShowDisable] = useState(false)
  const [disablePassword, setDisablePassword] = useState('')

  const start = () => {
    setError(null)
    startTransition(async () => {
      const res = await startEnrollmentAction()
      if ('error' in res) {
        setError(res.error)
        return
      }
      setSetup({ secret: res.secret, qr: res.qr })
    })
  }

  const confirm = () => {
    setError(null)
    startTransition(async () => {
      const res = await confirmEnrollmentAction(code)
      if ('error' in res) {
        setError(res.error)
        return
      }
      setBackupCodes(res.backupCodes)
      setSetup(null)
      setCode('')
    })
  }

  const disable = () => {
    setError(null)
    startTransition(async () => {
      const res = await disableEnrollmentAction(disablePassword)
      if ('error' in res) {
        setError(res.error)
        return
      }
      setShowDisable(false)
      setDisablePassword('')
    })
  }

  if (backupCodes) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium text-green-600">Two-factor authentication enabled.</p>
        <p className="text-xs text-muted-foreground">
          Save these backup codes somewhere safe. Each can be used once if you lose access to your authenticator.
        </p>
        <div className="grid grid-cols-2 gap-2 rounded-md border p-3 font-mono text-xs">
          {backupCodes.map((c) => (
            <span key={c}>{c}</span>
          ))}
        </div>
        <Button variant="outline" size="sm" className="self-start" onClick={() => setBackupCodes(null)}>
          Done
        </Button>
      </div>
    )
  }

  if (setup) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Scan this QR code with your authenticator app (Google Authenticator, Authy, 1Password), then enter the 6-digit code.
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={setup.qr} alt="2FA QR code" className="w-40 h-40 rounded-md border" />
        <div className="text-xs text-muted-foreground">
          Or enter this secret manually:
          <code className="ml-2 font-mono text-foreground">{setup.secret}</code>
        </div>
        <div className="flex flex-col gap-2">
          <InputOTP maxLength={6} value={code} onChange={setCode}>
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
              <InputOTPSlot index={3} />
              <InputOTPSlot index={4} />
              <InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button onClick={confirm} disabled={pending || code.length !== 6}>
              {pending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}
              Confirm
            </Button>
            <Button variant="ghost" onClick={() => setSetup(null)} disabled={pending}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        {enabled ? (
          <span className="inline-flex items-center gap-1 text-xs text-green-600">
            <ShieldCheck className="w-4 h-4" /> Enabled
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <ShieldOff className="w-4 h-4" /> Not enabled
          </span>
        )}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2">
        {!enabled && (
          <Button size="sm" onClick={start} disabled={pending}>
            {pending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}
            Enable 2FA
          </Button>
        )}
        {enabled && !showDisable && (
          <Button size="sm" variant="destructive" onClick={() => setShowDisable(true)} disabled={pending}>
            Disable 2FA
          </Button>
        )}
        {enabled && showDisable && (
          <div className="flex flex-col gap-3 p-3 rounded-md border border-destructive/30">
            <p className="text-xs text-muted-foreground">
              Enter your password to confirm you want to disable two-factor authentication.
            </p>
            <input
              type="password"
              value={disablePassword}
              onChange={(e) => setDisablePassword(e.target.value)}
              placeholder="Current password"
              autoComplete="current-password"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
            <div className="flex gap-2">
              <Button size="sm" variant="destructive" onClick={disable} disabled={pending || !disablePassword}>
                {pending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}
                Confirm disable
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setShowDisable(false); setDisablePassword(''); setError(null) }} disabled={pending}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
