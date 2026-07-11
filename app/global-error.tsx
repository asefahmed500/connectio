'use client'

import { useEffect } from 'react'
import { Manrope, Noto_Serif, Geist_Mono } from 'next/font/google'

const manrope = Manrope({
  variable: '--font-manrope',
  subsets: ['latin'],
})
const notoSerif = Noto_Serif({
  variable: '--font-noto-serif',
  subsets: ['latin'],
  weight: '400',
})
const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Global error:', error)
  }, [error])

  return (
    <html
      lang="en"
      className={`${manrope.variable} ${notoSerif.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center px-4">
          <div className="flex flex-col gap-2">
            <h1 className="text-4xl font-bold tracking-tight">Something went wrong</h1>
            <p className="text-sm text-muted-foreground max-w-md">
              An unexpected error occurred. Please try again or contact support.
            </p>
          </div>
          <button
            onClick={() => reset()}
            className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/80"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
