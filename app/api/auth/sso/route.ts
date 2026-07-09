import { NextResponse } from 'next/server'
import { getActiveProviders } from '@/lib/dal/sso'

// GET /api/auth/sso — list available SSO providers for the login screen
export async function GET() {
  const providers = await getActiveProviders()
  return NextResponse.json(providers)
}
