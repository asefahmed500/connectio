import { NextResponse } from 'next/server'
import { exportMyData } from '@/lib/dal/gdpr'
import { requireSession } from '@/lib/dal/session'

export async function GET() {
  const user = await requireSession()
  const data = await exportMyData()

  const filename = `connectio-export-${user.id.slice(0, 8)}-${new Date().toISOString().split('T')[0]}.json`

  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
