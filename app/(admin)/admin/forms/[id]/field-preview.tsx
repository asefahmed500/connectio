import type { FieldSchema } from '@/lib/forms/schema'

// Read-only preview of a field's metadata, shown on the admin edit page so the
// admin sees what clients will see without filling it out.

export function FieldPreview({ field }: { field: FieldSchema }) {
  return (
    <div className="text-sm">
      <div className="flex items-center gap-2">
        <span className="font-medium">{field.label}</span>
        {field.required && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
            required
          </span>
        )}
        <span className="text-xs font-mono text-muted-foreground">{field.type}</span>
      </div>
      {field.help && <p className="text-xs text-muted-foreground mt-0.5">{field.help}</p>}
      {field.options && field.options.length > 0 && (
        <ul className="text-xs text-muted-foreground mt-1 pl-4 list-disc">
          {field.options.map((o) => (
            <li key={o.value}>
              {o.label} <code className="text-[10px]">{o.value}</code>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
