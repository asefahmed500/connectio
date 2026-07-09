import 'server-only'
import { createTransport, type Transporter } from 'nodemailer'
import { prisma } from '@/lib/db'

let transporter: Transporter | null = null

export type EmailProvider = 'smtp' | 'gmail-oauth2' | 'gmail-app-password' | 'stub'

function getProviderName(): EmailProvider {
  if (
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REFRESH_TOKEN
  ) {
    return 'gmail-oauth2'
  }
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    return 'gmail-app-password'
  }
  const host = process.env.SMTP_HOST
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  if (host && user && pass) return 'smtp'
  return 'stub'
}

function getTransporter(): Transporter | null {
  if (transporter) return transporter

  // Priority: Gmail OAuth2 > Gmail App Password > Generic SMTP
  if (getProviderName() === 'gmail-oauth2') {
    transporter = createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: process.env.GMAIL_USER,
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
      },
    })
    return transporter
  }

  if (getProviderName() === 'gmail-app-password') {
    transporter = createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    })
    return transporter
  }

  const host = process.env.SMTP_HOST
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  if (host && user && pass) {
    transporter = createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    })
    return transporter
  }

  if (process.env.NODE_ENV === 'production') {
    console.error('[email] No email provider configured — emails will not be sent')
  }
  return null
}

export type SendEmailParams = {
  to: string
  subject: string
  text: string
  html?: string
  category?: string
}

async function logEmail(params: SendEmailParams, status: string, error?: string): Promise<void> {
  try {
    await prisma.emailLog.create({
      data: {
        to: params.to,
        subject: params.subject.slice(0, 500),
        category: params.category ?? null,
        provider: getProviderName(),
        status,
        error: error?.slice(0, 500) ?? null,
        htmlBody: params.html ? params.html.slice(0, 2000) : null,
        textBody: params.text.slice(0, 2000),
        deliveredAt: status === 'sent' ? new Date() : null,
      },
    })
  } catch (err) {
    console.error('[email] Failed to write EmailLog:', err)
  }
}

/**
 * Sends an email via SMTP. Gracefully degrades if SMTP is not configured —
 * logs the email to console in dev, silently drops in production.
 */
export async function sendEmail(params: SendEmailParams): Promise<void> {
  const t = getTransporter()
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER ?? 'noreply@clientconnect.local'

  if (!t) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[email stub] To: ${params.to}\nSubject: ${params.subject}\n\n${params.text}`)
    }
    await logEmail(params, 'skipped')
    return
  }

  try {
    await t.sendMail({
      from,
      to: params.to,
      subject: params.subject,
      text: params.text,
      html: params.html,
    })
    await logEmail(params, 'sent')
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await logEmail(params, 'failed', msg)
    console.error(`[email] Failed to send to ${params.to}:`, err)
    throw err
  }
}

/**
 * Sends a password reset email to the user.
 */
export async function sendPasswordResetEmail(opts: {
  to: string
  resetUrl: string
}): Promise<void> {
  const { renderStoredTemplate } = await import('@/lib/dal/email-templates')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const tpl = await renderStoredTemplate(
    'password_reset',
    { resetUrl: opts.resetUrl, appUrl },
    {
      subject: 'Reset your ClientConnect password',
      text: `Click this link to reset your password:\n\n${opts.resetUrl}\n\nThis link expires in 1 hour. If you didn't request this, ignore this email.`,
    },
  )
  await sendEmail({ to: opts.to, subject: tpl.subject, text: tpl.text, html: tpl.html, category: 'password_reset' })
}

/**
 * Sends a notification email (batched per recipient).
 */
export async function sendNotificationEmail(opts: {
  to: string
  title: string
  body: string
  href: string
}): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const { renderStoredTemplate } = await import('@/lib/dal/email-templates')
  const tpl = await renderStoredTemplate(
    'notification',
    { title: opts.title, body: opts.body, href: opts.href, appUrl },
    {
      subject: `[ClientConnect] ${opts.title}`,
      text: `${opts.body}\n\nView: ${appUrl}${opts.href}`,
    },
  )
  await sendEmail({ to: opts.to, subject: tpl.subject, text: tpl.text, html: tpl.html, category: 'notification' })
}
