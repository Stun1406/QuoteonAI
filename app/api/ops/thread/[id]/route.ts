import { NextRequest, NextResponse } from 'next/server'
import { getThreadDetail } from '@/lib/db/queries/thread-detail'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const detail = await getThreadDetail(id)

    if (!detail) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 })
    }

    return NextResponse.json(detail)
  } catch (err) {
    console.error('[/api/ops/thread] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
