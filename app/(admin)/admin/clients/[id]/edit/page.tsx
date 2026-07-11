import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getClientDTO } from '@/lib/dal/clients'
import { EditClientForm } from './edit-form'

export const metadata = { title: 'Edit client — ClientConnect' }

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const client = await getClientDTO(id)
  if (!client) notFound()

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <Link href={`/admin/clients/${id}`} className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to client
        </Link>
        <h1 className="text-3xl font-heading tracking-wide mt-2">Edit {client.companyName}</h1>
        <p className="text-sm text-muted-foreground">Update client details.</p>
      </div>
      <EditClientForm client={client} />
    </div>
  )
}
