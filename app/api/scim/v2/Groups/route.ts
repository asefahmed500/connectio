import { NextRequest, NextResponse } from 'next/server'
import { verifyScimApiKey } from '@/lib/dal/sso'
import { scimListGroups } from '@/lib/dal/scim'

async function requireScimAuth(req: NextRequest): Promise<boolean> {
  const auth = req.headers.get('authorization') ?? ''
  const match = auth.match(/^Bearer\s+(.+)$/i)
  if (!match) return false
  return verifyScimApiKey(match[1]!)
}

function error(status: number, detail: string) {
  return NextResponse.json(
    { schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'], status: String(status), detail },
    { status },
  )
}

export async function GET(req: NextRequest) {
  if (!(await requireScimAuth(req))) {
    return error(401, 'Invalid or missing SCIM bearer token')
  }

  const result = await scimListGroups()
  return NextResponse.json(result)
}

export async function POST() {
  return error(501, 'Group creation via SCIM not supported')
}
