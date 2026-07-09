import { NextRequest, NextResponse } from 'next/server'
import { generateSpMetadata } from '@/lib/dal/sso'

// GET /api/auth/sso/:id/metadata — SAML SP metadata XML
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const xml = await generateSpMetadata(baseUrl, id)

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/samlmetadata+xml',
      'Content-Disposition': `attachment; filename="saml-sp-metadata-${id.slice(0, 8)}.xml"`,
    },
  })
}
