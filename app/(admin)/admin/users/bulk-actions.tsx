'use client'

import { useRef } from 'react'

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
