import Link from 'next/link'

export function Footer() {
  return (
    <footer className="relative overflow-hidden border-t bg-card py-20">
      <div className="mx-auto max-w-6xl px-6 flex flex-col items-center gap-12 text-center">
        <div className="relative">
          <div className="pointer-events-none select-none text-[clamp(4rem,15vw,10rem)] font-heading leading-none tracking-wide text-muted/20">
            CLIENTCONNECT
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <span className="text-3xl font-heading tracking-wide text-foreground sm:text-4xl">
                CLIENTCONNECT
              </span>
              <p className="text-sm text-muted-foreground max-w-xs">
                Secure client communication, form submission, and file sharing.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-6 text-sm">
          <Link href="/login" className="text-muted-foreground hover:text-foreground transition-colors">
            Sign in
          </Link>
          <span className="text-muted-foreground/30">·</span>
          <span className="text-muted-foreground">© {new Date().getFullYear()} ClientConnect</span>
        </div>
      </div>
    </footer>
  )
}
