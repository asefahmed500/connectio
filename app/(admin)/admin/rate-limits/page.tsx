import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export const metadata = { title: 'Rate limits — ClientConnect' }

const RULES = [
  {
    name: 'Login by IP',
    key: 'login:ip:{ip}',
    limit: 10,
    window: 60,
    description: 'Login attempts per IP address',
  },
  {
    name: 'Login by email',
    key: 'login:email:{email}',
    limit: 5,
    window: 300,
    description: 'Login attempts per email address',
  },
  {
    name: 'Refresh token',
    key: 'refresh:{ip}',
    limit: 60,
    window: 60,
    description: 'Refresh token calls per IP address',
  },
  {
    name: 'Forgot password by IP',
    key: 'forgot-pw:ip:{ip}',
    limit: 5,
    window: 60,
    description: 'Password reset requests per IP address',
  },
  {
    name: 'Reset password form by IP',
    key: 'reset-pw:ip:{ip}',
    limit: 5,
    window: 60,
    description: 'Password reset form submissions per IP address',
  },
  {
    name: 'Invite registration by IP',
    key: 'invite-reg:ip:{ip}',
    limit: 5,
    window: 300,
    description: 'Invite accept/registration attempts per IP address',
  },
  {
    name: 'Invite registration by email',
    key: 'invite-reg:email:{email}',
    limit: 3,
    window: 600,
    description: 'Invite accept/registration attempts per email address',
  },
  {
    name: 'SSO OIDC callback by IP',
    key: 'sso-callback:ip:{ip}',
    limit: 10,
    window: 300,
    description: 'OIDC callback requests per IP address',
  },
]

export default function RateLimitsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-heading tracking-wide">Rate limits</h1>
        <p className="text-sm text-muted-foreground">
          Rate limiting configuration for abuse prevention.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-heading tracking-wide">Backend</CardTitle>
          <CardDescription>
            {process.env.UPSTASH_REDIS_REST_URL
              ? 'Upstash Redis (distributed)'
              : 'In-memory token bucket (per-process)'}
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-heading tracking-wide">Active rules</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {RULES.map((rule) => (
            <div
              key={rule.key}
              className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
            >
              <div className="flex flex-col gap-0.5">
                <span className="font-medium">{rule.name}</span>
                <span className="text-xs text-muted-foreground font-mono">{rule.key}</span>
                <span className="text-xs text-muted-foreground">{rule.description}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="outline" className="font-mono text-xs">
                  {rule.limit} / {rule.window}s
                </Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
