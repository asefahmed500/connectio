'use client'

import { useRef } from 'react'
import { Trash2 } from 'lucide-react'

export function DeleteButton({ formAction }: { formAction: (formData: FormData) => Promise<void> }) {
  return (
    <button
      type="submit"
      formAction={formAction}
      className="inline-flex h-8 items-center justify-center rounded-lg border border-destructive px-3 text-xs font-medium text-destructive hover:bg-destructive/10 gap-1"
      onClick={(e) => {
        if (!confirm('Delete selected users? This cannot be undone.')) e.preventDefault()
      }}
    >
      <Trash2 className="w-3 h-3" />
      Delete
    </button>
  )
}

export function SelectAllCheckbox({ count }: { count: number }) {
  const ref = useRef<HTMLInputElement>(null)

  const toggle = () => {
    const checked = ref.current?.checked ?? false
    const boxes = document.querySelectorAll<HTMLInputElement>('input[name="userIds"]')
    boxes.forEach((b) => {
      b.checked = checked
    })
  }

  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label="Select all users on this page"
      disabled={count === 0}
      onChange={toggle}
      className="rounded border-gray-300 cursor-pointer"
    />
  )
}
