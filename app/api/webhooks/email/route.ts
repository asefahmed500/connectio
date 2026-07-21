import { NextRequest, NextResponse } from 'next/server'
import { verifyHmacSignature } from '@/lib/webhooks/auth'

export const dynamic = 'force-dynamic'

// Receives outbound-email requests from internal services (e.g. a cron job that
// sends digest emails). The body MUST be signed with HMAC-SHA256 using the
// shared secret WEBHOOK_EMAIL_SECRET — fail-closed everywhere, including dev.
//
// Headers expected:
//   X-Webhook-Signature: sha256=<hex digest of the raw body>
export async function POST(request: NextRequest) {
  try {
    const secret = process.env.WEBHOOK_EMAIL_SECRET
    const rawBody = await request.text()
    const signature = request.headers.get('x-webhook-signature')

    if (!verifyHmacSignature(rawBody, signature, secret)) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }

    let body: { to?: unknown; subject?: unknown; text?: unknown; html?: unknown }
    try {
      body = JSON.parse(rawBody)
    } catch {
      return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
    }

    const { to, subject, text, html } = body
    if (typeof to !== 'string' || typeof subject !== 'string' || typeof text !== 'string') {
      return NextResponse.json({ ok: false, error: 'Missing required fields' }, { status: 400 })
    }

    const { sendEmail } = await import('@/lib/email')
    await sendEmail({
      to,
      subject,
      text,
      html: typeof html === 'string' ? html : undefined,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[webhook:email] Failed:', err)
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 })
  }
}
