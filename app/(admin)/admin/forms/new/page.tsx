import { FormEditor } from '../form-editor'

export const metadata = { title: 'New form — ClientConnect' }

const DEFAULT_SCHEMA = {
  version: 1 as const,
  fields: [
    {
      name: 'projectName',
      label: 'Project name',
      type: 'text' as const,
      required: true,
      maxLength: 120,
      placeholder: 'Acme Website Redesign',
    },
    {
      name: 'budget',
      label: 'Budget range',
      type: 'select' as const,
      required: true,
      options: [
        { label: '< $10k', value: 'lt_10k' },
        { label: '$10–25k', value: '10_25' },
        { label: '$25–50k', value: '25_50' },
        { label: '$50k+', value: 'gt_50' },
      ],
    },
    {
      name: 'brief',
      label: 'Project brief',
      type: 'textarea' as const,
      required: true,
      maxLength: 5000,
      help: 'Describe what you want to build, target audience, and any constraints.',
    },
  ],
}

export default function NewFormPage() {
  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New form</h1>
        <p className="text-sm text-muted-foreground">
          Forms start inactive. Flip the active switch when ready for clients.
        </p>
      </div>
      <FormEditor initialSchema={DEFAULT_SCHEMA} mode="create" />
    </div>
  )
}
