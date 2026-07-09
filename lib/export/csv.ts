export function toCsv<T extends Record<string, unknown>>(
  rows: T[],
  columns: { key: keyof T; label: string; format?: (value: T[keyof T]) => string }[],
): string {
  const header = columns.map((c) => escapeCsv(c.label)).join(',')
  const body = rows
    .map((row) =>
      columns
        .map((c) => {
          const value = row[c.key]
          const formatted = c.format ? c.format(value) : String(value ?? '')
          return escapeCsv(formatted)
        })
        .join(','),
    )
    .join('\n')
  return header + '\n' + body + '\n'
}

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
