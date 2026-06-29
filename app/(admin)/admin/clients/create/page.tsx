import Link from 'next/link'
import { CreateClientForm } from './create-form'

export const metadata = { title: 'Create client — ClientConnect' }

export default function CreateClientPage() {
  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <div>
        <Link href="/admin/clients" className="text-sm text-muted-foreground hover:text-foreground">
          ← All clients
        </Link>
        <h1 className="text-3xl font-heading tracking-wide mt-2">Create client account</h1>
        <p className="text-sm text-muted-foreground">
          Creates a user account and sends login credentials via email.
        </p>
      </div>
      <CreateClientForm />
    </div>
  )
}
