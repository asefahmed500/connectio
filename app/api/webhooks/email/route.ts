import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { to, subject, text, html } = body

    if (!to || !subject || !text) {
      return NextResponse.json({ ok: false, error: 'Missing required fields' }, { status: 400 })
    }

    const { sendEmail } = await import('@/lib/email')
    await sendEmail({ to, subject, text, html })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[webhook:email] Failed:', err)
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 })
  }
}
