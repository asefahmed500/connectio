import Link from 'next/link'

const PRODUCT_LINKS = [
  { href: '/login', label: 'Sign in' },
  { href: '/#features', label: 'Features' },
  { href: '/#how-it-works', label: 'How it works' },
]

const RESOURCE_LINKS = [
  { href: '/login', label: 'Documentation' },
  { href: '/login', label: 'API status' },
  { href: '/login', label: 'Support' },
]

const COMPANY_LINKS = [
  { href: '/login', label: 'About' },
  { href: '/login', label: 'Privacy' },
  { href: '/login', label: 'Terms' },
]

export function Footer() {
  return (
    <footer className="border-t bg-card">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="font-heading text-lg tracking-wide text-foreground">
              CLIENTCONNECT
            </Link>
            <p className="mt-3 text-sm text-muted-foreground max-w-xs">
              Secure client communication, form submission, and file sharing — with audit trails.
            </p>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Product
            </h3>
            <ul className="mt-3 flex flex-col gap-2">
              {PRODUCT_LINKS.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Resources
            </h3>
            <ul className="mt-3 flex flex-col gap-2">
              {RESOURCE_LINKS.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Company
            </h3>
            <ul className="mt-3 flex flex-col gap-2">
              {COMPANY_LINKS.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mt-12 border-t pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} ClientConnect. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
