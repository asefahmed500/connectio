'use client'

import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'
import type { ReactNode } from 'react'

export function ExportCsvButton<T extends Record<string, unknown>>({
  label = 'Export CSV',
  fetchUrl,
  columns,
  filename,
}: {
  label?: ReactNode
  fetchUrl: string
  columns: { key: keyof T; label: string; format?: (value: T[keyof T]) => string }[]
  filename: string
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        const res = await fetch(fetchUrl, { credentials: 'same-origin' })
        if (!res.ok) return
        const data = (await res.json()) as { items: T[] }
        const csv = toCsv(data.items ?? [], columns)
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        a.click()
        URL.revokeObjectURL(url)
      }}
    >
      <Download data-icon="inline-start" />
      {label}
    </Button>
  )
}

function toCsv<T extends Record<string, unknown>>(
  rows: T[],
  columns: { key: keyof T; label: string; format?: (value: T[keyof T]) => string }[],
): string {
  const header = columns.map((c) => esc(c.label)).join(',')
  const body = rows
    .map((row) =>
      columns
        .map((c) => {
          const value = row[c.key]
          const formatted = c.format ? c.format(value) : String(value ?? '')
          return esc(formatted)
        })
        .join(','),
    )
    .join('\n')
  return header + '\n' + body + '\n'
}

function esc(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}
