import { NextRequest, NextResponse } from 'next/server'
import { verifyScimApiKey } from '@/lib/dal/sso'
import {
  scimGetUser,
  scimUpdateUser,
  scimPatchUser,
  scimDeleteUser,
  ScimValidationError,
} from '@/lib/dal/scim'
import type { ScimErrorResponse } from '@/lib/dal/scim'

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

// GET /Users/{id} — fetch a single user
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireScimAuth(req))) return error(401, 'Invalid or missing SCIM bearer token')
  const { id } = await params
  const user = await scimGetUser(id)
  if (!user) return error(404, 'User not found')
  return NextResponse.json(user)
}

// PUT /Users/{id} — full update
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireScimAuth(req))) return error(401, 'Invalid or missing SCIM bearer token')
  const { id } = await params

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return error(400, 'Invalid JSON body')
  }

  try {
    const user = await scimUpdateUser(id, {
      userName: body.userName as string | undefined,
      givenName: (body.name as { givenName?: string } | undefined)?.givenName,
      familyName: (body.name as { familyName?: string } | undefined)?.familyName,
      active: body.active as boolean | undefined,
      role: (body.roles as { value: string }[] | undefined)?.[0]?.value as unknown as Parameters<typeof scimUpdateUser>[1]['role'],
    })
    if (!user) return error(404, 'User not found')
    return NextResponse.json(user)
  } catch (err) {
    if (err instanceof ScimValidationError) return error(400, err.message)
    return error(500, 'Update failed')
  }
}

// PATCH /Users/{id} — partial update (SCIM PATCH operations)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireScimAuth(req))) return error(401, 'Invalid or missing SCIM bearer token')
  const { id } = await params

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return error(400, 'Invalid JSON body')
  }

  try {
    const user = await scimPatchUser(
      id,
      (body.Operations ?? body.operations ?? []) as Parameters<typeof scimPatchUser>[1],
    )
    if (!user) return error(404, 'User not found')
    return NextResponse.json(user)
  } catch (err) {
    if (err instanceof ScimValidationError) return error(400, err.message)
    return error(500, 'Patch failed')
  }
}

// DELETE /Users/{id} — soft-delete (deprovision)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireScimAuth(req))) return error(401, 'Invalid or missing SCIM bearer token')
  const { id } = await params

  const deleted = await scimDeleteUser(id)
  if (!deleted) return error(404, 'User not found')

  const { writeAudit } = await import('@/lib/audit')
  await writeAudit({
    action: 'SCIM_USER_DEPROVISIONED',
    userId: null,
    resource: 'User',
    resourceId: id,
  })

  return new NextResponse(null, { status: 204 })
}
