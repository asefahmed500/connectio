'use client'

import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'
import type { ReactNode } from 'react'

// NOTE: `format` MUST be a serializable string tag, never a function —
// `columns` is passed from Server Components, and functions cannot cross
// the RSC boundary.
export type ColumnFormat = 'string' | 'boolean' | 'date'

export type CsvColumn<T extends Record<string, unknown>> = {
  key: keyof T
  label: string
  format?: ColumnFormat
}

export function ExportCsvButton<T extends Record<string, unknown>>({
  label = 'Export CSV',
  fetchUrl,
  columns,
  filename,
}: {
  label?: ReactNode
  fetchUrl: string
  columns: CsvColumn<T>[]
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

function formatValue(value: unknown, fmt: ColumnFormat | undefined): string {
  switch (fmt) {
    case 'boolean':
      return value ? 'Yes' : 'No'
    case 'date':
      return value ? new Date(value as string).toISOString().slice(0, 10) : ''
    default:
      return value == null ? '' : String(value)
  }
}

function toCsv<T extends Record<string, unknown>>(
  rows: T[],
  columns: CsvColumn<T>[],
): string {
  const header = columns.map((c) => esc(c.label)).join(',')
  const body = rows
    .map((row) =>
      columns
        .map((c) => esc(formatValue(row[c.key], c.format)))
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
