import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { verifyScimApiKey } from '@/lib/dal/sso'
import {
  scimListUsers,
  scimGetUser,
  scimCreateUser,
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

const CreateSchema = z.object({
  schemas: z.array(z.string()).optional(),
  userName: z.email(),
  name: z.object({ givenName: z.string().optional(), familyName: z.string().optional() }).optional(),
  active: z.boolean().optional(),
  password: z.string().optional(),
  roles: z.array(z.object({ value: z.string() })).optional(),
})

const UpdateSchema = z.object({
  schemas: z.array(z.string()).optional(),
  userName: z.email().optional(),
  name: z.object({ givenName: z.string().optional(), familyName: z.string().optional() }).optional(),
  active: z.boolean().optional(),
  password: z.string().optional(),
  roles: z.array(z.object({ value: z.string() })).optional(),
})

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
  const count = Math.min(parseInt(url.searchParams.get('count') ?? '100', 10), 200)
  const filter = url.searchParams.get('filter') ?? undefined

  const result = await scimListUsers(startIndex, count, filter)
  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  if (!(await requireScimAuth(req))) {
    return error(401, 'Invalid or missing SCIM bearer token')
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return error(400, 'Invalid JSON body')
  }

  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) {
    return error(400, parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '))
  }

  try {
    const user = await scimCreateUser({
      userName: parsed.data.userName,
      givenName: parsed.data.name?.givenName,
      familyName: parsed.data.name?.familyName,
      active: parsed.data.active,
      password: parsed.data.password,
      // scimCreateUser validates against the SCIM allowlist internally and
      // throws ScimValidationError if the role is disallowed.
      role: parsed.data.roles?.[0]?.value as unknown as Parameters<typeof scimCreateUser>[0]['role'],
    })

    const { writeAudit } = await import('@/lib/audit')
    await writeAudit({
      action: 'SCIM_USER_PROVISIONED',
      userId: null,
      resource: 'User',
      resourceId: user.id,
    })

    return NextResponse.json(user, { status: 201 })
  } catch (err) {
    if (err instanceof ScimValidationError) {
      return error(400, err.message)
    }
    // Prisma unique-constraint violation → 409, everything else → 500
    const code = (err as { code?: string }).code
    if (code === 'P2002') return error(409, 'User already exists', 'uniqueness')
    console.error('[SCIM] Failed to create user:', err)
    return error(500, 'Create failed')
  }
}

export async function PUT(req: NextRequest) {
  if (!(await requireScimAuth(req))) {
    return error(401, 'Invalid or missing SCIM bearer token')
  }

  const userId = req.nextUrl.searchParams.get('filter')?.match(/id\s+eq\s+"([^"]+)"/i)?.[1]
  if (!userId) return error(400, 'User ID required')

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return error(400, 'Invalid JSON body')
  }

  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) {
    return error(400, parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '))
  }

  try {
    const user = await scimUpdateUser(userId, {
      userName: parsed.data.userName,
      givenName: parsed.data.name?.givenName,
      familyName: parsed.data.name?.familyName,
      active: parsed.data.active,
      role: parsed.data.roles?.[0]?.value as unknown as Parameters<typeof scimUpdateUser>[1]['role'],
    })

    if (!user) return error(404, 'User not found')
    return NextResponse.json(user)
  } catch (err) {
    if (err instanceof ScimValidationError) return error(400, err.message)
    return error(500, 'Update failed')
  }
}

// PATCH and DELETE on /Users (no id segment) are not standard SCIM.
// Standard clients target /Users/<id> — handled by app/api/scim/v2/Users/[id]/route.ts.
export async function PATCH() {
  return error(400, 'PATCH must target /Users/{id}')
}

export async function DELETE() {
  return error(400, 'DELETE must target /Users/{id}')
}
