import 'server-only'
import { createTransport, type Transporter } from 'nodemailer'

let transporter: Transporter | null = null

function getTransporter(): Transporter | null {
  if (transporter) return transporter

  const host = process.env.SMTP_HOST
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  if (!host || !user || !pass) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[email] SMTP not configured — emails will not be sent')
    }
    return null
  }

  transporter = createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  })

  return transporter
}

export type SendEmailParams = {
  to: string
  subject: string
  text: string
  html?: string
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
  } catch (err) {
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
  await sendEmail({
    to: opts.to,
    subject: 'Reset your ClientConnect password',
    text: `Click this link to reset your password:\n\n${opts.resetUrl}\n\nThis link expires in 1 hour. If you didn't request this, ignore this email.`,
  })
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
  await sendEmail({
    to: opts.to,
    subject: `[ClientConnect] ${opts.title}`,
    text: `${opts.body}\n\nView: ${appUrl}${opts.href}`,
  })
}
