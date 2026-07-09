import { NextRequest, NextResponse } from 'next/server'
import { verifyScimApiKey } from '@/lib/dal/sso'
import {
  scimListUsers,
  scimGetUser,
  scimCreateUser,
  scimUpdateUser,
  scimPatchUser,
  scimDeleteUser,
} from '@/lib/dal/scim'
import type { ScimErrorResponse } from '@/lib/dal/scim'
import type { UserRole } from '@prisma/client'

async function requireScimAuth(req: NextRequest): Promise<boolean> {
  const auth = req.headers.get('authorization') ?? ''
  const match = auth.match(/^Bearer\s+(.+)$/i)
  if (!match) return false
  return verifyScimApiKey(match[1]!)
}

function error(status: number, detail: string, scimType?: string): NextResponse<ScimErrorResponse> {
  return NextResponse.json(
    { schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'], status: String(status), scimType, detail },
    { status },
  )
}

export async function GET(req: NextRequest) {
  if (!(await requireScimAuth(req))) {
    return error(401, 'Invalid or missing SCIM bearer token')
  }

  const url = req.nextUrl
  const userId = url.searchParams.get('filter')?.match(/id\s+eq\s+"([^"]+)"/i)?.[1] ?? null
  const userName = url.searchParams.get('filter')?.match(/userName\s+eq\s+"([^"]+)"/i)?.[1] ?? null

  if (userId) {
    const user = await scimGetUser(userId)
    if (!user) return error(404, 'User not found')
    return NextResponse.json(user)
  }

  if (userName) {
    const result = await scimListUsers(1, 1, `userName eq "${userName}"`)
    return NextResponse.json(result)
  }

  const startIndex = parseInt(url.searchParams.get('startIndex') ?? '1', 10)
  const count = parseInt(url.searchParams.get('count') ?? '100', 10)
  const filter = url.searchParams.get('filter') ?? undefined

  const result = await scimListUsers(startIndex, count, filter)
  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  if (!(await requireScimAuth(req))) {
    return error(401, 'Invalid or missing SCIM bearer token')
  }

  try {
    const body = await req.json()

    if (body.schemas?.[0] !== 'urn:ietf:params:scim:schemas:core:2.0:User') {
      return error(400, 'Invalid schema')
    }

    const user = await scimCreateUser({
      userName: body.userName,
      givenName: body.name?.givenName,
      familyName: body.name?.familyName,
      active: body.active,
      role: body.roles?.[0]?.value as UserRole | undefined,
    })

    // Audit the SCIM provisioning
    const { writeAudit } = await import('@/lib/audit')
    await writeAudit({
      action: 'SCIM_USER_PROVISIONED',
      userId: null,
      resource: 'User',
      resourceId: user.id,
    })

    return NextResponse.json(user, { status: 201 })
  } catch (err) {
    console.error('[SCIM] Failed to create user:', err)
    return error(409, 'User may already exist or invalid data', 'uniqueness')
  }
}

export async function PUT(req: NextRequest) {
  if (!(await requireScimAuth(req))) {
    return error(401, 'Invalid or missing SCIM bearer token')
  }

  const userId = req.nextUrl.searchParams.get('filter')?.match(/id\s+eq\s+"([^"]+)"/i)?.[1]
  if (!userId) return error(400, 'User ID required')

  try {
    const body = await req.json()
    const user = await scimUpdateUser(userId, {
      userName: body.userName,
      givenName: body.name?.givenName,
      familyName: body.name?.familyName,
      active: body.active,
      role: body.roles?.[0]?.value as UserRole | undefined,
    })

    if (!user) return error(404, 'User not found')
    return NextResponse.json(user)
  } catch {
    return error(500, 'Update failed')
  }
}

export async function PATCH(req: NextRequest) {
  if (!(await requireScimAuth(req))) {
    return error(401, 'Invalid or missing SCIM bearer token')
  }

  // Extract user ID from the URL path
  const pathParts = req.nextUrl.pathname.split('/').filter(Boolean)
  const userId = pathParts[pathParts.length - 1]

  // If it's a direct user ID, try get; otherwise list
  if (userId && userId !== 'Users') {
    try {
      const body = await req.json()
      const user = await scimPatchUser(userId, body.Operations ?? body.operations ?? [])
      if (!user) return error(404, 'User not found')
      return NextResponse.json(user)
    } catch {
      return error(500, 'Patch failed')
    }
  }

  return error(400, 'User ID required in URL path')
}

export async function DELETE(req: NextRequest) {
  if (!(await requireScimAuth(req))) {
    return error(401, 'Invalid or missing SCIM bearer token')
  }

  const pathParts = req.nextUrl.pathname.split('/').filter(Boolean)
  const userId = pathParts[pathParts.length - 1]

  if (!userId || userId === 'Users') {
    return error(400, 'User ID required in URL path')
  }

  const deleted = await scimDeleteUser(userId)
  if (!deleted) return error(404, 'User not found')

  const { writeAudit } = await import('@/lib/audit')
  await writeAudit({
    action: 'SCIM_USER_DEPROVISIONED',
    userId: null,
    resource: 'User',
    resourceId: userId,
  })

  return new NextResponse(null, { status: 204 })
}
