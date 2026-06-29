import 'server-only'

export function renderWelcomeEmail(opts: {
  contactName: string
  companyName: string
  email: string
  password: string
  loginUrl: string
}): { subject: string; text: string; html: string } {
  const subject = `Welcome to ClientConnect — ${opts.companyName} account created`
  const text = [
    `Hello ${opts.contactName},`,
    '',
    `Your ${opts.companyName} account on ClientConnect has been created.`,
    '',
    'Here are your login credentials:',
    `  URL: ${opts.loginUrl}`,
    `  Email: ${opts.email}`,
    `  Password: ${opts.password}`,
    '',
    'For security, please change your password after logging in.',
    '',
    'Best regards,',
    'The ClientConnect Team',
  ].join('\n')
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Manrope, -apple-system, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 24px;">
  <div style="border-bottom: 2px solid #e5e5e5; padding-bottom: 16px; margin-bottom: 24px;">
    <h1 style="font-family: 'Noto Serif', serif; font-size: 24px; margin: 0; color: #7a5c2e;">ClientConnect</h1>
  </div>
  <p>Hello <strong>${opts.contactName}</strong>,</p>
  <p>Your <strong>${opts.companyName}</strong> account on ClientConnect has been created.</p>
  <div style="background: #f5f5f5; border-radius: 8px; padding: 16px; margin: 16px 0;">
    <p style="margin: 0 0 8px;"><strong>Login credentials:</strong></p>
    <p style="margin: 0 0 4px; font-size: 14px;">URL: <a href="${opts.loginUrl}">${opts.loginUrl}</a></p>
    <p style="margin: 0 0 4px; font-size: 14px;">Email: ${opts.email}</p>
    <p style="margin: 0; font-size: 14px;">Password: <code style="background: #e5e5e5; padding: 2px 6px; border-radius: 4px; font-size: 13px;">${opts.password}</code></p>
  </div>
  <p style="font-size: 13px; color: #666;">For security, please change your password after logging in.</p>
  <div style="border-top: 1px solid #e5e5e5; padding-top: 16px; margin-top: 24px; font-size: 12px; color: #999;">
    <p>ClientConnect — Secure client portal</p>
  </div>
</body>
</html>`
  return { subject, text, html }
}

export function renderInviteEmail(opts: {
  contactName: string
  companyName: string
  inviteUrl: string
}): { subject: string; text: string; html: string } {
  const subject = `You're invited to ClientConnect — ${opts.companyName}`
  const text = [
    `Hello ${opts.contactName},`,
    '',
    `You've been invited to join ${opts.companyName} on ClientConnect.`,
    '',
    `Click the link below to set up your account:`,
    `  ${opts.inviteUrl}`,
    '',
    'This link expires in 7 days.',
    '',
    'Best regards,',
    'The ClientConnect Team',
  ].join('\n')
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Manrope, -apple-system, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 24px;">
  <div style="border-bottom: 2px solid #e5e5e5; padding-bottom: 16px; margin-bottom: 24px;">
    <h1 style="font-family: 'Noto Serif', serif; font-size: 24px; margin: 0; color: #7a5c2e;">ClientConnect</h1>
  </div>
  <p>Hello <strong>${opts.contactName}</strong>,</p>
  <p>You've been invited to join <strong>${opts.companyName}</strong> on ClientConnect.</p>
  <a href="${opts.inviteUrl}" style="display: inline-block; background: #7a5c2e; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 6px; margin: 16px 0; font-weight: 500;">Set up your account</a>
  <p style="font-size: 13px; color: #666;">This link expires in 7 days.</p>
  <div style="border-top: 1px solid #e5e5e5; padding-top: 16px; margin-top: 24px; font-size: 12px; color: #999;">
    <p>ClientConnect — Secure client portal</p>
  </div>
</body>
</html>`
  return { subject, text, html }
}
