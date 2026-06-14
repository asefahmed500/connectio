// Auth-only layout for /login, /forgot-password, /reset-password.
// Bare wrapper — these pages should NOT have the admin/team/client chrome.

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen">{children}</div>
}
