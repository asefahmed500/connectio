'use client'

export function GeneralSettingsForm() {
  return (
    <section className="border rounded-lg p-4 space-y-3">
      <h2 className="text-sm font-semibold">General settings</h2>
      <p className="text-sm text-muted-foreground">
        Settings are managed via environment variables. See <code className="text-xs bg-muted px-1 rounded">.env.example</code> for the full catalog.
      </p>
      <ul className="text-sm space-y-1 text-muted-foreground list-disc pl-5">
        <li>Change the app URL: set <code className="text-xs bg-muted px-1 rounded">NEXT_PUBLIC_APP_URL</code></li>
        <li>Configure email: set <code className="text-xs bg-muted px-1 rounded">SMTP_HOST</code>, <code className="text-xs bg-muted px-1 rounded">SMTP_USER</code>, etc.</li>
        <li>Enable S3 storage: set <code className="text-xs bg-muted px-1 rounded">S3_BUCKET</code>, <code className="text-xs bg-muted px-1 rounded">S3_REGION</code>, etc.</li>
        <li>Enable Redis rate limiting: set <code className="text-xs bg-muted px-1 rounded">UPSTASH_REDIS_REST_URL</code></li>
        <li>Max upload size: set <code className="text-xs bg-muted px-1 rounded">MAX_UPLOAD_BYTES</code> (default: 50MB)</li>
      </ul>
    </section>
  )
}
