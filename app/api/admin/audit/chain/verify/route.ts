import { NextResponse } from 'next/server'
import { verifyAuditChain, getChainDigest } from '@/lib/dal/audit-chain'

export async function GET() {
  const digest = await getChainDigest()
  return NextResponse.json(digest)
}

export async function POST() {
  const result = await verifyAuditChain()
  return NextResponse.json(result)
}
